import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { ICommonObject } from '../src'
import { getModelConfigByModelName, MODEL_TYPE } from '../src/modelLoader'

export class PraxEvaluationRunner {
    static metrics = new Map<string, string[]>()

    static getCostMetrics = async (provider: string, model: string) => {
        let config = await getModelConfigByModelName(MODEL_TYPE.CHAT, provider, model)
        if (config?.cost_values) return config.cost_values
        if (config) return { cost_values: config }

        config = await getModelConfigByModelName(MODEL_TYPE.LLM, provider, model)
        if (config?.cost_values) return config.cost_values
        if (config) return { cost_values: config }

        return undefined
    }

    static async getAndClear(id: string) {
        const logs = PraxEvaluationRunner.metrics.get(id)
        if (logs) {
            try {
                let selectedModel
                let selectedProvider
                for (const entry of logs) {
                    const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry
                    if (parsed.model) selectedModel = parsed.model
                    if (parsed.provider) selectedProvider = parsed.provider
                }

                if (selectedProvider && selectedModel) {
                    const config = await PraxEvaluationRunner.getCostMetrics(selectedProvider, selectedModel)
                    if (config) {
                        logs.push(JSON.stringify({ cost_values: config }))
                    }
                }
            } catch {
                // fail silently
            }
        }
        PraxEvaluationRunner.metrics.delete(id)
        return logs
    }

    static add(id: string, metric: string) {
        if (!PraxEvaluationRunner.metrics.has(id)) {
            PraxEvaluationRunner.metrics.set(id, [])
        }
        PraxEvaluationRunner.metrics.get(id)?.push(metric)
    }

    baseURL = ''

    constructor(baseURL: string) {
        this.baseURL = baseURL
    }

    getApiKey(flowId: string, keys: { chatflowId: string; apiKey: string }[] = []) {
        return keys.find((k) => k.chatflowId === flowId)?.apiKey || ''
    }

    async run(data: ICommonObject) {
        const flowIds = JSON.parse(data.chatflowId)
        const results: ICommonObject = {
            evaluationId: data.evaluationId,
            runDate: new Date(),
            rows: data.dataset.rows.map((r: any) => ({
                input: r.input,
                expectedOutput: r.output,
                itemNo: r.sequenceNo,
                evaluations: [],
                status: 'pending'
            }))
        }

        for (const flowId of flowIds) {
            await this.evaluate(flowId, this.getApiKey(flowId, data.apiKeys), data, results)
        }

        return results
    }

    async evaluate(flowId: string, apiKey: string, data: any, results: any) {
        for (let i = 0; i < data.dataset.rows.length; i++) {
            const row = data.dataset.rows[i]
            const uuid = uuidv4()

            const headers: any = {
                'X-Request-ID': uuid,
                'X-Flowise-Evaluation': 'true'
            }
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

            const config = { headers }
            const start = performance.now()

            const run: any = {
                chatflowId: flowId,
                startTime: start,
                uuid,
                status: 'pending',
                evaluations: []
            }

            const payload: any = {
                question: row.input,
                evaluationRunId: uuid,
                evaluation: true
            }
            if (data.sessionId) {
                payload.overrideConfig = { sessionId: data.sessionId }
            }

            try {
                const res = await axios.post(`${this.baseURL}/api/v1/prediction/${flowId}`, payload, config)

                const nested: any[] = []
                const end = performance.now()
                const latency = (end - start).toFixed(2)

                if (res?.data?.agentFlowExecutedData) {
                    for (const exec of res.data.agentFlowExecutedData) {
                        const input = exec?.data?.output?.usageMetadata?.input_tokens || 0
                        const output = exec?.data?.output?.usageMetadata?.output_tokens || 0
                        const total = exec?.data?.output?.usageMetadata?.total_tokens || input + output

                        const provider = exec.data?.input?.llmModelConfig?.llmModel || exec.data?.input?.agentModelConfig?.agentModel
                        const model = exec.data?.input?.llmModelConfig?.modelName || exec.data?.input?.agentModelConfig?.modelName

                        const metric: any = {
                            promptTokens: input,
                            completionTokens: output,
                            totalTokens: total,
                            provider,
                            model,
                            nodeLabel: exec.nodeLabel,
                            nodeId: exec.nodeId
                        }

                        if (provider && model) {
                            const cost = await PraxEvaluationRunner.getCostMetrics(provider, model)
                            if (cost?.cost_values) {
                                const inputCost = (cost.cost_values.input_cost || 0) * (input / 1000)
                                const outputCost = (cost.cost_values.output_cost || 0) * (output / 1000)
                                metric.cost_values = {
                                    input_cost: inputCost,
                                    output_cost: outputCost,
                                    total_cost: inputCost + outputCost
                                }
                            }
                        }

                        nested.push(metric)
                    }
                }

                run.metrics = res.data.metrics || []
                run.metrics.push({ apiLatency: latency })
                run.actualOutput = res.data.text || (res.data.json ? '```json\n' + JSON.stringify(res.data.json, null, 2) : JSON.stringify(res.data, null, 2))
                run.latency = latency
                run.nested_metrics = nested
                run.status = 'complete'
                run.error = ''

            } catch (err: any) {
                const end = performance.now()
                const latency = (end - start).toFixed(2)

                let error = err?.response?.data?.message || err?.message || 'Unknown error'
                if (error.includes('-')) {
                    error = 'Error: ' + error.substring(error.indexOf('-') + 1).trim()
                }

                run.status = 'error'
                run.actualOutput = ''
                run.error = error
                run.latency = latency
                run.metrics = [{ apiLatency: latency }]
            }

            results.rows[i].evaluations.push(run)
        }

        return results
    }
}
