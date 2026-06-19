import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamType } from '@prisma/client';
import { resolveCandidateId } from '../../common/utils/candidate.util';
import { parsePage, parseLimit } from '../../common/utils/pagination.util';
@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  async create(
    tenantId: string,
    userId: string,
    data: {
      title: string;
      code: string;
      type: ExamType;
      startTime: string;
      endTime: string;
      timezone?: string;
      settings?: Record<string, unknown>;
      securityPolicy?: Record<string, unknown>;
      sections?: { name: string; orderIndex: number; durationMinutes?: number }[];
    },
  ) {
    return this.prisma.exam.create({
      data: {
        tenantId,
        title: data.title,
        code: data.code,
        type: data.type,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        timezone: data.timezone || 'UTC',
        settings: (data.settings || {}) as never,
        securityPolicy: (data.securityPolicy || {}) as never,
        createdById: userId,
        sections: data.sections
          ? { create: data.sections }
          : undefined,
      },
      include: { sections: true },
    });
  }

  async findAll(tenantId: string, page?: unknown, limit?: unknown) {
    const p = parsePage(page);
    const l = parseLimit(limit);
    const [items, total] = await Promise.all([
      this.prisma.exam.findMany({
        where: { tenantId },
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: { _count: { select: { questions: true } } },
          },
          _count: { select: { registrations: true, sessions: true, results: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { startTime: 'desc' },
      }),
      this.prisma.exam.count({ where: { tenantId } }),
    ]);
    return { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }
  async findOne(id: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId },
      include: {
        sections: {
          include: { questions: { include: { question: true } } },
          orderBy: { orderIndex: 'asc' },
        },
        registrations: {
          include: {
            candidate: {
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    return exam;
  }

  async publish(id: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id, tenantId } });
    if (!exam) throw new NotFoundException('Exam not found');

    const [questionCount, registrationCount] = await Promise.all([
      this.prisma.examQuestion.count({ where: { examId: id } }),
      this.prisma.examRegistration.count({ where: { examId: id } }),
    ]);
    if (questionCount === 0) {
      throw new BadRequestException('Add at least one approved question before publishing');
    }
    if (registrationCount === 0) {
      throw new BadRequestException('Assign at least one candidate before publishing');
    }

    return this.prisma.exam.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async assignCandidates(examId: string, tenantId: string, candidateIds: string[]) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, tenantId } });
    if (!exam) throw new NotFoundException('Exam not found');

    const candidates = await this.prisma.candidate.findMany({
      where: { id: { in: candidateIds }, tenantId },
    });
    if (candidates.length !== candidateIds.length) {
      throw new BadRequestException('One or more candidates are invalid for this tenant');
    }

    const existing = await this.prisma.examRegistration.findMany({
      where: { examId, candidateId: { in: candidateIds } },
      select: { candidateId: true },
    });
    const existingIds = new Set(existing.map((r) => r.candidateId));
    const data = candidateIds
      .filter((candidateId) => !existingIds.has(candidateId))
      .map((candidateId) => ({ examId, candidateId }));
    if (!data.length) return { count: 0, skipped: candidateIds.length };
    const result = await this.prisma.examRegistration.createMany({ data });
    return { count: result.count, skipped: candidateIds.length - result.count };
  }

  async addQuestions(
    examId: string,
    tenantId: string,
    userId: string,
    sectionId: string,
    questionIds: string[],
  ) {
    const section = await this.prisma.examSection.findFirst({
      where: { id: sectionId, exam: { id: examId, tenantId } },
    });
    if (!section) throw new NotFoundException('Section not found');

    const uniqueIds = [...new Set(questionIds)];
    const alreadyLinked = await this.prisma.examQuestion.findMany({
      where: { sectionId, questionId: { in: uniqueIds } },
      select: { questionId: true },
    });
    const linkedSet = new Set(alreadyLinked.map((q) => q.questionId));
    const newIds = uniqueIds.filter((id) => !linkedSet.has(id));

    if (!newIds.length) {
      return { added: 0, skipped: uniqueIds.length, exam: await this.findOne(examId, tenantId) };
    }

    const found = await this.prisma.question.findMany({
      where: { id: { in: newIds }, tenantId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (found.length !== newIds.length) {
      throw new BadRequestException('One or more questions are invalid for this tenant');
    }

    const draftIds = found.filter((q) => q.status === 'DRAFT').map((q) => q.id);
    if (draftIds.length) {
      await this.prisma.question.updateMany({
        where: { id: { in: draftIds } },
        data: { status: 'APPROVED' },
      });
      for (const q of found.filter((item) => item.status === 'DRAFT')) {
        const version = q.versions[0];
        if (version) {
          await this.prisma.questionVersion.update({
            where: { id: version.id },
            data: { approvedById: userId, approvedAt: new Date() },
          });
          await this.prisma.question.update({
            where: { id: q.id },
            data: { currentVersionId: version.id },
          });
        }
      }
    }

    const orderBase = await this.prisma.examQuestion.count({ where: { sectionId } });
    await this.prisma.examQuestion.createMany({
      data: newIds.map((questionId, i) => ({
        examId,
        sectionId,
        questionId,
        orderIndex: orderBase + i + 1,
      })),
    });

    return {
      added: newIds.length,
      skipped: uniqueIds.length - newIds.length,
      exam: await this.findOne(examId, tenantId),
    };
  }

  async removeQuestion(examId: string, tenantId: string, questionId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, tenantId } });
    if (!exam) throw new NotFoundException('Exam not found');
    if (exam.status !== 'DRAFT') {
      throw new BadRequestException('Questions can only be removed while the exam is in draft');
    }

    const link = await this.prisma.examQuestion.findFirst({ where: { examId, questionId } });
    if (!link) throw new NotFoundException('Question is not on this exam');

    await this.prisma.examQuestion.delete({ where: { id: link.id } });
    return { removed: true, exam: await this.findOne(examId, tenantId) };
  }

  async remove(id: string, tenantId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { sessions: true, results: true } } },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (exam.status === 'COMPLETED') {
      throw new BadRequestException('Cannot delete a completed exam');
    }
    if (exam._count.results > 0) {
      throw new BadRequestException('Cannot delete: exam has candidate results on record');
    }
    if (exam._count.sessions > 0) {
      throw new BadRequestException('Cannot delete: candidates have started or submitted this exam');
    }

    await this.prisma.$transaction([
      this.prisma.examRegistration.deleteMany({ where: { examId: id } }),
      this.prisma.examQuestion.deleteMany({ where: { examId: id } }),
      this.prisma.examSection.deleteMany({ where: { examId: id } }),
      this.prisma.exam.delete({ where: { id } }),
    ]);

    return { deleted: true };
  }

  async getAvailableForCandidate(userId: string) {
    const candidateId = await resolveCandidateId(this.prisma, userId);
    return this.prisma.examRegistration.findMany({
      where: { candidateId },
      include: {
        exam: true,
        sessions: {
          where: { candidateId },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, submittedAt: true },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });
  }
}
