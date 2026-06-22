import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '@cbt/shared';

@ApiTags('AI')
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('status')
  @RequirePermissions(Permission.QUESTION_CREATE)
  @ApiOperation({ summary: 'Check AI / OpenAI configuration status' })
  getStatus() {
    return this.aiService.getStatus();
  }

  @Post('questions/generate')
  @RequirePermissions(Permission.QUESTION_CREATE)
  @ApiOperation({ summary: 'AI-generate exam questions' })
  generateQuestions(
    @Body() body: { topic: string; count?: number; difficulty?: string; type?: string },
  ) {
    return this.aiService.generateQuestions({
      topic: body.topic,
      count: Math.min(body.count || 3, 10),
      difficulty: body.difficulty || 'MEDIUM',
      type: body.type || 'MCQ',
    });
  }

  @Get('insights/exam/:examId')
  @RequirePermissions(Permission.ANALYTICS_VIEW)
  @ApiOperation({ summary: 'AI-powered exam insights' })
  getExamInsights(
    @Param('examId') examId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.aiService.getExamInsights(examId, tenantId);
  }

  @Post('chat')
  @RequirePermissions(Permission.TENANT_READ)
  @ApiOperation({ summary: 'AI assistant chat' })
  chat(
    @Body() body: { message: string; context?: { role?: string; page?: string } },
    @CurrentUser('sub') userId: string,
  ) {
    return this.aiService.chat(body.message, { ...body.context, role: userId });
  }

  @Post('proctoring/analyze')
  @RequirePermissions(Permission.EXAM_TAKE)
  @ApiOperation({ summary: 'Analyze proctoring frame with AI' })
  analyzeFrame(@Body() body: { sessionId: string; thumbnail: string }) {
    return this.aiService.processProctoringFrame(body.sessionId, body.thumbnail);
  }
}
