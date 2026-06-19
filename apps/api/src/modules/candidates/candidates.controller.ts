import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CandidatesService } from './candidates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '@cbt/shared';

@ApiTags('Candidates')
@Controller('candidates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CandidatesController {
  constructor(private candidatesService: CandidatesService) {}

  @Get()
  @RequirePermissions(Permission.CANDIDATE_READ)
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.candidatesService.findAll(tenantId, page, limit, search);
  }

  @Post()
  @RequirePermissions(Permission.CANDIDATE_CREATE)
  @ApiOperation({ summary: 'Create a candidate account' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { email: string; password: string; firstName: string; lastName: string; registrationNumber?: string },
  ) {
    return this.candidatesService.create(tenantId, body);
  }

  @Get('me/dashboard')
  @RequirePermissions(Permission.CANDIDATE_READ)
  getDashboard(@CurrentUser('sub') userId: string) {
    return this.candidatesService.getDashboardByUser(userId);
  }

  @Get('me/admit-card/:examId')
  @RequirePermissions(Permission.CANDIDATE_ADMIT_CARD)
  @ApiOperation({ summary: 'Get admit card for an exam' })
  getAdmitCard(@CurrentUser('sub') userId: string, @Param('examId') examId: string) {
    return this.candidatesService.getAdmitCard(userId, examId);
  }

  @Get(':id')
  @RequirePermissions(Permission.CANDIDATE_READ)
  findOne(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.candidatesService.findOne(id, tenantId);
  }

  @Patch(':id/kyc/verify')
  @RequirePermissions(Permission.CANDIDATE_KYC_VERIFY)
  verifyKyc(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body('status') status: 'VERIFIED' | 'REJECTED',
  ) {
    return this.candidatesService.updateKyc(id, tenantId, status);
  }
}
