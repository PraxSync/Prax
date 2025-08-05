import {
    ChatMessage,
    LLMEndEvent,
    LLMStartEvent,
    LLMStreamEvent,
    MessageContentTextDetail,
    RetrievalEndEvent,
    Settings
} from 'llamaindex'
import { PraxEvaluationRunner } from './PraxEvaluationRunner'
import { additionalCallbacks, ICommonObject, INodeData } from '../src'
import { RetrievalStartEvent } from 'llamaindex/dist/type/llm/types'
import { AgentEndEvent, AgentStartEvent } from 'llamaindex/dist/type/agent/types'
import { encoding_for_model } from '@dqbd/tiktoken'
import { MessageContent } from '@langchain/core/messages'

export class PraxLlamaTracer {
    evaluationId: string
    static initialized = false
    static startTimes = new Map<string, number>()
    static models = new Map<string, string>()
    static tokenCounts = new Map<string, number>()

    constructor(id: string) {
        this.evaluationId = id
        PraxLlamaTracer.setup()
    }

    static setup = () => {
        if (PraxLlamaTracer.initialized) return

        Settings.callbackManager.on('llm-start', (event: LLMStartEvent) => {
            const id = getEvalId(event)
            if (!id) return

            const model = (event as any).reason?.caller?.model
            if (model) {
                PraxLlamaTracer.models.set(id, model)
                try {
                    const encoding = encoding_for_model(model)
                    const messages = event.detail.payload.messages
                    const promptTokens = messages.reduce((count: number, m: ChatMessage) => {
                        return count + encoding.encode(extractText(m.content)).length
                    }, 0)
                    PraxLlamaTracer.tokenCounts.set(id + '_promptTokens', promptTokens)
                    PraxLlamaTracer.tokenCounts.set(id + '_outputTokens', 0)
                } catch {}
            }

            PraxLlamaTracer.startTimes.set(id + '_llm', event.timeStamp)
        })

        Settings.callbackManager.on('llm-end', (event: LLMEndEvent) => {
            PraxLlamaTracer.finalize(event, 'llm')
        })

        Settings.callbackManager.on('llm-stream', (event: LLMStreamEvent) => {
            const id = getEvalId(event)
            if (!id) return

            const delta = event.detail.payload.chunk.delta
            const model = (event as any).reason?.caller?.model

            try {
                const encoding = encoding_for_model(model)
                let count = PraxLlamaTracer.tokenCounts.get(id + '_outputTokens') || 0
                count += encoding.encode(extractText(delta)).length
                PraxLlamaTracer.tokenCounts.set(id + '_outputTokens', count)
            } catch {}
        })

        Settings.callbackManager.on('retrieve-start', (event: RetrievalStartEvent) => {
            const id = getEvalId(event)
            if (id) {
                PraxLlamaTracer.startTimes.set(id + '_retriever', event.timeStamp)
            }
        })

        Settings.callbackManager.on('retrieve-end', (event: RetrievalEndEvent) => {
            PraxLlamaTracer.finalize(event, 'retriever')
        })

        Settings.callbackManager.on('agent-start', (event: AgentStartEvent) => {
            const id = getEvalId(event)
            if (id) {
                PraxLlamaTracer.startTimes.set(id + '_agent', event.timeStamp)
            }
        })

        Settings.callbackManager.on('agent-end', (event: AgentEndEvent) => {
            PraxLlamaTracer.finalize(event, 'agent')
        })

        PraxLlamaTracer.initialized = true
    }

    private static finalize(event: any, type: string) {
        const id = getEvalId(event)
        if (!id) return

        const start = PraxLlamaTracer.startTimes.get(id + '_' + type)
        const model = event.reason?.caller?.model || event.reason?.caller?.llm?.model || PraxLlamaTracer.models.get(id)

        const response = event.detail?.payload?.response
        if (response?.message && model) {
            try {
                const encoding = encoding_for_model(model)
                let outputCount = PraxLlamaTracer.tokenCounts.get(id + '_outputTokens') || 0
                outputCount += encoding.encode(response.message.content || '').length
                PraxLlamaTracer.tokenCounts.set(id + '_outputTokens', outputCount)
            } catch {}
        }

        const usageAnthropic = response?.raw?.usage
        const usageBedrock = response?.raw?.['amazon-bedrock-invocationMetrics']

        if (usageAnthropic) {
            const metric = usageAnthropic.output_tokens
                ? {
                      completionTokens: usageAnthropic.output_tokens,
                      promptTokens: usageAnthropic.input_tokens,
                      model,
                      totalTokens: usageAnthropic.input_tokens + usageAnthropic.output_tokens
                  }
                : {
                      completionTokens: usageAnthropic.completion_tokens,
                      promptTokens: usageAnthropic.prompt_tokens,
                      model,
                      totalTokens: usageAnthropic.total_tokens
                  }
            PraxEvaluationRunner.add(id, JSON.stringify(metric))
        } else if (usageBedrock) {
            const metric = {
                completionTokens: usageBedrock.outputTokenCount,
                promptTokens: usageBedrock.inputTokenCount,
                model: response?.raw?.model,
                totalTokens: usageBedrock.inputTokenCount + usageBedrock.outputTokenCount
            }
            PraxEvaluationRunner.add(id, JSON.stringify(metric))
        } else {
            const metric = {
                [type]: (event.timeStamp - start).toFixed(2),
                completionTokens: PraxLlamaTracer.tokenCounts.get(id + '_outputTokens'),
                promptTokens: PraxLlamaTracer.tokenCounts.get(id + '_promptTokens'),
                model: model || '',
                totalTokens:
                    (PraxLlamaTracer.tokenCounts.get(id + '_outputTokens') || 0) +
                    (PraxLlamaTracer.tokenCounts.get(id + '_promptTokens') || 0)
            }
            PraxEvaluationRunner.add(id, JSON.stringify(metric))
        }

        PraxLlamaTracer.startTimes.delete(id + '_' + type)
        PraxLlamaTracer.tokenCounts.delete(id + '_outputTokens')
        PraxLlamaTracer.tokenCounts.delete(id + '_promptTokens')
        PraxLlamaTracer.models.delete(id)
    }

    static async injectMetadata(nodeData: INodeData, options: ICommonObject, callerObj: any) {
        if (options.evaluationRunId && callerObj) {
            options.llamaIndex = true
            await additionalCallbacks(nodeData, options)
            Object.defineProperty(callerObj, 'evaluationRunId', {
                enumerable: true,
                configurable: true,
                writable: true,
                value: options.evaluationRunId
            })
        }
    }
}

function getEvalId(event: any): string | undefined {
    return event.reason?.parent?.caller?.evaluationRunId || event.reason?.caller?.evaluationRunId
}

export function extractText(message: MessageContent): string {
    if (typeof message !== 'string' && !Array.isArray(message)) {
        return `${message}`
    } else if (Array.isArray(message)) {
        return message
            .filter((c): c is MessageContentTextDetail => c.type === 'text')
            .map((c) => c.text)
            .join('\n\n')
    } else {
        return message
    }
}
