import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@cbt/shared';
import { parsePage, parseLimit } from '../../common/utils/pagination.util';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class CandidatesService {  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, page?: unknown, limit?: unknown, search?: string) {
    const p = parsePage(page);
    const l = parseLimit(limit);
    const where = {
      tenantId,
      ...(search && {
        OR: [
          { registrationNumber: { contains: search } },
          { user: { email: { contains: search } } },
          { user: { firstName: { contains: search } } },
          { user: { lastName: { contains: search } } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        include: {
          user: { select: { email: true, firstName: true, lastName: true, status: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.candidate.count({ where }),
    ]);
    return { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getKycStats(tenantId: string) {
    const [total, verified, pending, rejected] = await Promise.all([
      this.prisma.candidate.count({ where: { tenantId } }),
      this.prisma.candidate.count({ where: { tenantId, kycStatus: 'VERIFIED' } }),
      this.prisma.candidate.count({ where: { tenantId, kycStatus: 'PENDING' } }),
      this.prisma.candidate.count({ where: { tenantId, kycStatus: 'REJECTED' } }),
    ]);
    return { total, verified, pending, rejected };
  }

  async submitKyc(
    userId: string,
    data: { documentType: string; idNumber: string; fileName: string; fileData: string },
  ) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) throw new NotFoundException('Candidate profile not found');
    if (!data.fileName?.trim() || !data.fileData?.trim()) {
      throw new BadRequestException('Document file is required');
    }
    if (data.fileData.length > 4_000_000) {
      throw new BadRequestException('Document is too large (max ~3MB)');
    }

    await this.prisma.candidateDocument.deleteMany({
      where: { candidateId: candidate.id, type: data.documentType },
    });

    await this.prisma.candidateDocument.create({
      data: {
        candidateId: candidate.id,
        type: data.documentType,
        fileName: data.fileName,
        fileUrl: data.fileData,
        fileSize: data.fileData.length,
        mimeType: data.fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      },
    });

    return this.prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        kycStatus: 'PENDING',
        profileData: {
          ...(candidate.profileData as object),
          idNumber: data.idNumber,
          documentType: data.documentType,
          submittedAt: new Date().toISOString(),
        },
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { email: true, firstName: true, lastName: true, phone: true } },
        documents: true,
      },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate;
  }

  async create(
    tenantId: string,
    data: { email: string; password: string; firstName: string; lastName: string; registrationNumber?: string },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: data.email } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const candidateRole = await this.prisma.role.findUnique({ where: { name: Role.CANDIDATE } });
    if (!candidateRole) throw new BadRequestException('Candidate role not configured');

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const regNo = data.registrationNumber || `CAND-${Date.now().toString().slice(-8)}`;

    const duplicateReg = await this.prisma.candidate.findFirst({
      where: { tenantId, registrationNumber: regNo },
    });
    if (duplicateReg) throw new ConflictException('Registration number already exists');

    return this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        status: 'ACTIVE',
        emailVerified: true,
        userRoles: { create: { roleId: candidateRole.id } },
        candidate: {
          create: {
            tenantId,
            registrationNumber: regNo,
            kycStatus: 'NOT_SUBMITTED',
          },
        },
      },
      include: {
        candidate: true,
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });
  }

  async updateKyc(id: string, tenantId: string, status: 'VERIFIED' | 'REJECTED') {
    const candidate = await this.prisma.candidate.findFirst({ where: { id, tenantId } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    return this.prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        kycStatus: status,
        kycVerifiedAt: status === 'VERIFIED' ? new Date() : null,
      },
    });
  }

  async getDashboardByUser(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { userId } });
    if (!candidate) throw new NotFoundException('Candidate profile not found');
    return this.getDashboard(candidate.id);
  }

  async getDashboard(candidateId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const [examCount, sessionStats, results] = await Promise.all([
      this.prisma.examRegistration.count({ where: { candidateId } }),
      this.prisma.examSession.groupBy({
        by: ['status'],
        where: { candidateId },
        _count: true,
      }),
      this.prisma.examResult.findMany({
        where: { candidateId, published: true },
        select: { percentage: true },
      }),
    ]);

    const countByStatus = (status: string) =>
      sessionStats.find((s) => s.status === status)?._count ?? 0;
    const submittedExams = countByStatus('SUBMITTED') + countByStatus('AUTO_SUBMITTED');
    const inProgressExams = countByStatus('IN_PROGRESS');
    const averageScore = results.length
      ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length
      : null;

    return {
      profile: {
        registrationNumber: candidate.registrationNumber,
        kycStatus: candidate.kycStatus,
        email: candidate.user.email,
        fullName: `${candidate.user.firstName} ${candidate.user.lastName}`,
      },
      stats: {
        totalExams: examCount,
        submittedExams,
        inProgressExams,
        publishedResults: results.length,
        averageScore,
      },
    };
  }

  async getAdmitCard(userId: string, examId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');

    const registration = await this.prisma.examRegistration.findUnique({
      where: { examId_candidateId: { examId, candidateId: candidate.id } },
      include: { exam: true },
    });
    if (!registration) throw new NotFoundException('Not registered for this exam');

    const admitCardUrl = registration.admitCardUrl
      || `/admit-cards/${registration.id}`;

    if (!registration.admitCardUrl) {
      await this.prisma.examRegistration.update({
        where: { id: registration.id },
        data: { admitCardUrl, status: 'ADMIT_CARD_ISSUED' },
      });
    }

    return {
      admitCardId: registration.id,
      admitCardUrl,
      registrationNumber: candidate.registrationNumber,
      candidateName: `${candidate.user.firstName} ${candidate.user.lastName}`,
      candidateEmail: candidate.user.email,
      examTitle: registration.exam.title,
      examCode: registration.exam.code,
      startTime: registration.exam.startTime,
      endTime: registration.exam.endTime,
      timezone: registration.exam.timezone,
      venue: 'Online Proctored Examination',
      instructions: [
        'Arrive 15 minutes before the scheduled start time.',
        'Ensure a stable internet connection and working webcam.',
        'Keep a valid photo ID ready for verification.',
        'Fullscreen mode is required during the examination.',
      ],
    };
  }
}
