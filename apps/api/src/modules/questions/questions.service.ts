import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { parsePage, parseLimit } from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionType, QuestionDifficulty, QuestionStatus, Prisma } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    tenantId: string,
    userId: string,
    data: {
      type: QuestionType;
      difficulty?: QuestionDifficulty;
      topicId?: string;
      title?: string;
      content: Record<string, unknown>;
      options?: Record<string, unknown>;
      correctAnswer?: Record<string, unknown>;
      marks?: number;
      negativeMarks?: number;
      tags?: string[];
    },
  ) {
    const question = await this.prisma.question.create({
      data: {
        tenantId,
        type: data.type,
        difficulty: data.difficulty || 'MEDIUM',
        topicId: data.topicId,
        title: data.title,
        createdById: userId,
        versions: {
          create: {
            versionNumber: 1,
            content: data.content as Prisma.InputJsonValue,
            options: data.options as Prisma.InputJsonValue,
            correctAnswer: data.correctAnswer as Prisma.InputJsonValue,
            marks: data.marks || 1,
            negativeMarks: data.negativeMarks || 0,
          },
        },
        tags: data.tags
          ? { create: data.tags.map((tag) => ({ tag })) }
          : undefined,
      },
      include: { versions: true, tags: true },
    });
    return question;
  }

  async findAll(
    tenantId: string,
    filters: { type?: QuestionType; difficulty?: QuestionDifficulty; status?: QuestionStatus; search?: string },
    page?: unknown,
    limit?: unknown,
  ) {
    const p = parsePage(page);
    const l = parseLimit(limit);
    const where: Prisma.QuestionWhereInput = {
      tenantId,
      ...(filters.type && { type: filters.type }),
      ...(filters.difficulty && { difficulty: filters.difficulty }),
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search } },
          { tags: { some: { tag: { contains: filters.search } } } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          tags: true,
          topic: { select: { name: true } },
        },
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.question.count({ where }),
    ]);
    return { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async approve(id: string, userId: string, tenantId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id, tenantId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!question) throw new NotFoundException('Question not found');

    const latestVersion = question.versions[0];
    if (latestVersion) {
      await this.prisma.questionVersion.update({
        where: { id: latestVersion.id },
        data: { approvedById: userId, approvedAt: new Date() },
      });
    }

    return this.prisma.question.update({
      where: { id },
      data: { status: 'APPROVED', currentVersionId: latestVersion?.id },
    });
  }

  async remove(id: string, tenantId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id, tenantId },
      include: {
        examQuestions: {
          include: { section: { include: { exam: { select: { status: true, title: true } } } } },
        },
        _count: { select: { responses: true } },
      },
    });
    if (!question) throw new NotFoundException('Question not found');

    if (question._count.responses > 0) {
      throw new BadRequestException('Cannot delete: candidates have already answered this question');
    }

    const lockedExam = question.examQuestions.find(
      (link) => !['DRAFT', 'CANCELLED'].includes(link.section.exam.status),
    );
    if (lockedExam) {
      throw new BadRequestException(
        `Cannot delete: question is on exam "${lockedExam.section.exam.title}" which is ${lockedExam.section.exam.status}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.examQuestion.deleteMany({ where: { questionId: id } }),
      this.prisma.questionTag.deleteMany({ where: { questionId: id } }),
      this.prisma.questionVersion.deleteMany({ where: { questionId: id } }),
      this.prisma.question.delete({ where: { id } }),
    ]);

    return { deleted: true };
  }
}
