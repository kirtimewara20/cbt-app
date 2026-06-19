import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; slug: string; domain?: string }) {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain,
      },
    });
  }

  async findAll(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateBranding(id: string, branding: Record<string, unknown>) {
    return this.prisma.tenant.update({
      where: { id },
      data: { branding: branding as never },
    });
  }

  async updateSecurityConfig(id: string, securityConfig: Record<string, unknown>) {
    return this.prisma.tenant.update({
      where: { id },
      data: { securityConfig: securityConfig as never },
    });
  }
}
