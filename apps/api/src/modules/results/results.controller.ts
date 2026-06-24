import { Controller, Get, Post, Patch, Param, Query, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ResultsService } from './results.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '@cbt/shared';

@ApiTags('Results')
@Controller('results')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ResultsController {
  constructor(private resultsService: ResultsService) {}

  @Get('verify/:resultId')
  @Public()
  @ApiOperation({ summary: 'Public certificate verification' })
  verifyCertificate(@Param('resultId') resultId: string) {
    return this.resultsService.verifyCertificate(resultId);
  }

  @Get('my')
  @RequirePermissions(Permission.RESULT_READ)
  @ApiOperation({ summary: 'Get my results' })
  getMyResults(@CurrentUser('sub') userId: string) {
    return this.resultsService.getMyResults(userId);
  }

  @Get('my/:resultId/certificate')
  @RequirePermissions(Permission.RESULT_CERTIFICATE)
  @ApiOperation({ summary: 'Get certificate for a published result' })
  getCertificate(
    @CurrentUser('sub') userId: string,
    @Param('resultId') resultId: string,
  ) {
    return this.resultsService.getCertificate(userId, resultId);
  }

  @Post('evaluate/:sessionId')
  @RequirePermissions(Permission.RESULT_EVALUATE)
  evaluate(@Param('sessionId') sessionId: string) {
    return this.resultsService.evaluateSession(sessionId);
  }

  @Post('rank/:examId')
  @RequirePermissions(Permission.RESULT_RANK)
  calculateRanks(@Param('examId') examId: string) {
    return this.resultsService.calculateRanks(examId);
  }

  @Post('publish/:examId')
  @RequirePermissions(Permission.RESULT_PUBLISH)
  publish(@Param('examId') examId: string) {
    return this.resultsService.publishResults(examId);
  }

  @Get('exam/:examId/subjective')
  @RequirePermissions(Permission.RESULT_EVALUATE)
  getSubjectiveResponses(@Param('examId') examId: string) {
    return this.resultsService.getSubjectiveResponses(examId);
  }

  @Patch('grade/:sessionId/:questionId')
  @RequirePermissions(Permission.RESULT_EVALUATE)
  gradeResponse(
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
    @Body('marksAwarded') marksAwarded: number,
  ) {
    return this.resultsService.gradeResponse(sessionId, questionId, marksAwarded);
  }

  @Get('exam/:examId')
  @RequirePermissions(Permission.RESULT_READ)
  getExamResults(
    @Param('examId') examId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.resultsService.getExamResults(examId, page, limit);
  }

  @Get('exam/:examId/export')
  @RequirePermissions(Permission.RESULT_READ)
  async exportExamResults(@Param('examId') examId: string, @Res() res: Response) {
    const csv = await this.resultsService.exportExamResultsCsv(examId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="results-${examId}.csv"`);
    res.send(csv);
  }
}
