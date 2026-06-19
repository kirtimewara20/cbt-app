# 14. CI/CD Pipeline

## Pipeline Overview

```mermaid
flowchart LR
    subgraph Trigger
        PR[Pull Request]
        MERGE[Merge to main]
        TAG[Release Tag]
    end

    subgraph CI["CI Pipeline"]
        LINT[Lint & Format]
        TYPE[Type Check]
        UNIT[Unit Tests]
        INT[Integration Tests]
        BUILD[Build]
        SCAN[Security Scan]
        DOCKER[Docker Build]
    end

    subgraph CD_Staging["CD Staging"]
        PUSH_S[Push to ECR]
        DEPLOY_S[Deploy to Staging]
        E2E[E2E Tests]
        SMOKE[Smoke Tests]
    end

    subgraph CD_Prod["CD Production"]
        APPROVE[Manual Approval]
        PUSH_P[Push to ECR]
        DEPLOY_P[Rolling Deploy]
        VERIFY[Health Check]
        ROLLBACK[Auto Rollback]
    end

    PR --> LINT --> TYPE --> UNIT --> INT --> BUILD --> SCAN
    MERGE --> DOCKER --> PUSH_S --> DEPLOY_S --> E2E --> SMOKE
    TAG --> APPROVE --> PUSH_P --> DEPLOY_P --> VERIFY
    VERIFY -->|Fail| ROLLBACK
```

## GitHub Actions Workflows

### CI Pipeline (`ci.yml`)

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm exec prettier --check .

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec tsc --noEmit -p apps/api
      - run: pnpm exec tsc --noEmit -p apps/web
      - run: pnpm exec tsc --noEmit -p packages/shared

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: cbt_test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @cbt/api prisma:generate
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/cbt_test
          REDIS_URL: redis://localhost:6379
          JWT_ACCESS_SECRET: test-access-secret-min-32-characters
          JWT_REFRESH_SECRET: test-refresh-secret-min-32-characters

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - name: Dependency audit
        run: pnpm audit --audit-level=high
      - name: SAST scan
        uses: github/codeql-action/analyze@v3
        with:
          languages: typescript

  build:
    needs: [lint, typecheck, test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### CD Staging (`cd-staging.yml`)

```yaml
name: Deploy Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-south-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push API
        run: |
          docker build -t $ECR_REGISTRY/cbt-api:$GITHUB_SHA -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/cbt-api:$GITHUB_SHA

      - name: Build and push Web
        run: |
          docker build -t $ECR_REGISTRY/cbt-web:$GITHUB_SHA -f apps/web/Dockerfile .
          docker push $ECR_REGISTRY/cbt-web:$GITHUB_SHA

      - name: Deploy to EKS
        run: |
          aws eks update-kubeconfig --name cbt-staging
          kubectl set image deployment/cbt-api api=$ECR_REGISTRY/cbt-api:$GITHUB_SHA -n cbt-staging
          kubectl set image deployment/cbt-web web=$ECR_REGISTRY/cbt-web:$GITHUB_SHA -n cbt-staging
          kubectl rollout status deployment/cbt-api -n cbt-staging --timeout=300s
          kubectl rollout status deployment/cbt-web -n cbt-staging --timeout=300s

      - name: Run migrations
        run: |
          kubectl exec -n cbt-staging deploy/cbt-api -- npx prisma migrate deploy

      - name: Smoke tests
        run: |
          curl -f https://staging.cbt-platform.com/health
          curl -f https://staging-api.cbt-platform.com/api/v1/health
```

### CD Production (`cd-production.yml`)

```yaml
name: Deploy Production

on:
  push:
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-south-1

      - name: Build and push images
        run: |
          docker build -t $ECR_REGISTRY/cbt-api:${{ github.ref_name }} -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/cbt-api:${{ github.ref_name }}

      - name: Deploy (rolling update)
        run: |
          aws eks update-kubeconfig --name cbt-production
          kubectl set image deployment/cbt-api api=$ECR_REGISTRY/cbt-api:${{ github.ref_name }} -n cbt-production
          kubectl rollout status deployment/cbt-api -n cbt-production --timeout=600s

      - name: Verify deployment
        run: |
          for i in {1..10}; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.cbt-platform.com/health)
            if [ "$STATUS" = "200" ]; then exit 0; fi
            sleep 10
          done
          exit 1

      - name: Rollback on failure
        if: failure()
        run: |
          kubectl rollout undo deployment/cbt-api -n cbt-production
          kubectl rollout undo deployment/cbt-web -n cbt-production
```

## Branch Strategy

```
main ────────────── Production releases (tags: v*)
  │
develop ─────────── Staging deployments
  │
feature/* ───────── Feature branches (PR → develop)
hotfix/* ────────── Hotfix branches (PR → main + develop)
```

## Database Migration Strategy

1. Migrations run as Kubernetes Job before deployment
2. Backward-compatible migrations only (no column drops in same release)
3. Destructive changes use expand-contract pattern
4. Pre-exam freeze: no migrations 48 hours before scheduled exams

## Monitoring Integration

- **Deployment notifications:** Slack #deployments channel
- **Error tracking:** Sentry release tracking
- **APM:** Datadog deployment markers
- **Metrics:** CloudWatch alarms on 5xx rate during deployment
