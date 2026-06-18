import type { FastifyInstance } from 'fastify'
import {
  answerKnowledgeQuestion,
  parseInspectionReport,
  isAiUpstreamError,
  isAiValidationError,
} from '../services/aiService.js'
import { matchKnowledge } from '../services/knowledgeRetrievalService.js'

type ParseInspectionReportBody = {
  reportId: number
}

type KnowledgeMatchBody = {
  question: string
  topK?: number
}

type KnowledgeAnswerBody = unknown

export async function aiRoutes(app: FastifyInstance) {
  app.post<{
    Body: ParseInspectionReportBody
  }>('/parse-inspection-report', async (request, reply) => {
    try {
      const result = await parseInspectionReport(request.body)

      return {
        ok: true,
        data: result,
      }
    } catch (error) {
      if (isAiValidationError(error) || isAiUpstreamError(error)) {
        if (error.statusCode === 502) {
          request.log.error(
            {
              reportId: request.body?.reportId,
              error: error.message,
            },
            'Failed to parse inspection report with DeepSeek',
          )
        }

        return reply.code(error.statusCode).send({
          ok: false,
          error: {
            message: error.message,
          },
        })
      }

      throw error
    }
  })

  app.post<{
    Body: KnowledgeMatchBody
  }>('/knowledge-match', async (request, reply) => {
    try {
      const result = await matchKnowledge(request.body)

      return {
        ok: true,
        data: result,
      }
    } catch (error) {
      if (isAiValidationError(error) || isAiUpstreamError(error)) {
        if (error.statusCode === 502) {
          request.log.error(
            {
              question: request.body?.question,
              topK: request.body?.topK,
              error: error.message,
            },
            'Failed to match knowledge chunks with DashScope',
          )
        }

        return reply.code(error.statusCode).send({
          ok: false,
          error: {
            message: error.message,
          },
        })
      }

      throw error
    }
  })

  app.post<{
    Body: KnowledgeAnswerBody
  }>('/knowledge-answer', async (request, reply) => {
    try {
      const result = await answerKnowledgeQuestion(request.body)

      return {
        ok: true,
        data: result,
      }
    } catch (error) {
      if (isAiValidationError(error) || isAiUpstreamError(error)) {
        if (error.statusCode === 502) {
          request.log.error(
            {
              question: getKnowledgeAnswerQuestionForLog(request.body),
              error: error.message,
            },
            'Failed to answer knowledge question with DeepSeek',
          )
        }

        return reply.code(error.statusCode).send({
          ok: false,
          error: {
            message: error.message,
          },
        })
      }

      throw error
    }
  })
}

function getKnowledgeAnswerQuestionForLog(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined
  }

  if ('question' in body && typeof body.question === 'string') {
    return body.question
  }

  if ('data' in body && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    const data = body.data as Record<string, unknown>

    return typeof data.question === 'string' ? data.question : undefined
  }

  return undefined
}
