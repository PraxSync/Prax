import { RunCollectorCallbackHandler } from '@langchain/core/tracers/run_collector'
import { Run } from '@langchain/core/tracers/base'
import { PraxEvaluationRunner } from './PraxEvaluationRunner'
import { encoding_for_model, get_encoding } from '@dqbd/tiktoken'

export class PraxEvaluationTracer extends RunCollectorCallbackHandler {
    evaluationId: string
    model: string

    constructor(id: string) {
        super()
        this.evaluationId = id
    }

    async persistRun(run: Run): Promise<void> {
        return super.persistRun(run)
    }

    countPromptTokens = (encoding: any, run: Run): number => {
        let count = 0
        if (!encoding) return 0

        const messages = run.inputs?.messages?.[0]
        if (messages?.length > 0) {
            messages.forEach((msg: any) => {
                const content = msg.content ||
                    msg.SystemMessage?.content ||
                    msg.HumanMessage?.content ||
                    msg.AIMessage?.content
                count += content ? encoding.encode(content).length : 0
            })
        }

        const prompt = run.inputs?.prompts?.[0]
        if (prompt) {
            count += encoding.encode(prompt).length
        }

        return count
    }

    countCompletionTokens = (encoding: any, run: Run): number => {
        let count = 0
        if (!encoding) return 0

        const gens = run.outputs?.generations?.[0]
        if (gens?.length > 0) {
            gens.forEach((g: any) => {
                const content = g.text || g.message?.content
                count += content ? encoding.encode(content).length : 0
            })
        }

        return count
    }

    extractModelName = (run: Run): string => {
        return (
            (run?.serialized as any)?.kwargs?.model ||
            (run?.serialized as any)?.kwargs?.model_name ||
            (run?.extra as any)?.metadata?.ls_model_name ||
            (run?.extra as any)?.metadata?.fw_model_name
        )
    }

    onLLMEnd?(run: Run): void | Promise<void> {
        const provider = run.name === 'BedrockChat' ? 'awsChatBedrock' : run.name
        PraxEvaluationRunner.add(this.evaluationId, { provider })

        const model = this.extractModelName(run)

        const usage1 = run.outputs?.llmOutput?.tokenUsage
        if (usage1) {
            const metric = {
                completionTokens: usage1.completionTokens,
                promptTokens: usage1.promptTokens,
                model,
                totalTokens: usage1.totalTokens
            }
            PraxEvaluationRunner.add(this.evaluationId, metric)
            return
        }

        const usage2 = run.outputs?.generations?.[0]?.[0]?.message?.usage_metadata
        if (usage2) {
            const metric = {
                completionTokens: usage2.output_tokens,
                promptTokens: usage2.input_tokens,
                model,
                totalTokens: usage2.total_tokens
            }
            PraxEvaluationRunner.add(this.evaluationId, metric)
            return
        }

        let encoding: any = null
        let promptTokens = 0
        let completionTokens = 0

        try {
            encoding = encoding_for_model(model)
        } catch {
            try {
                encoding = get_encoding('cl100k_base')
            } catch {
                encoding = null
            }
        }

        if (encoding) {
            promptTokens = this.countPromptTokens(encoding, run)
            completionTokens = this.countCompletionTokens(encoding, run)
        }

        const metric = {
            completionTokens,
            promptTokens,
            model,
            totalTokens: promptTokens + completionTokens
        }

        PraxEvaluationRunner.add(this.evaluationId, metric)
        this.model = ''
    }

    async onRunUpdate(run: Run): Promise<void> {
        if (run.end_time) {
            const durationMs = run.end_time - run.start_time
            PraxEvaluationRunner.add(this.evaluationId, {
                [run.run_type]: durationMs.toFixed(2)
            })
        }

        if (run.run_type === 'llm') {
            const model = this.extractModelName(run)
            if (model) {
                PraxEvaluationRunner.add(this.evaluationId, { model })
                this.model = model
            }

            const estimated = run.outputs?.llmOutput?.estimatedTokenUsage
            if (estimated && typeof estimated === 'object') {
                PraxEvaluationRunner.add(this.evaluationId, estimated)
            }
        }
    }
}
