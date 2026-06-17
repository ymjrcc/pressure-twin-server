import 'dotenv/config'
import OpenAI from "openai";
import { env } from '../config/env.js'

const openai = new OpenAI({
  apiKey: env.dashscopeApiKey,
  baseURL: env.dashscopeBaseUrl,
  timeout: env.dashscopeTimeoutMs,
});

async function getEmbedding() {
  try {
    const inputText = "衣服的质量杠杠的";

    console.log('DashScope config:', {
      baseURL: env.dashscopeBaseUrl,
      timeoutMs: env.dashscopeTimeoutMs,
      apiKeyPrefix: `${env.dashscopeApiKey.slice(0, 8)}...`,
      model: 'text-embedding-v4',
    });

    const startedAt = Date.now();
    const completion = await openai.embeddings.create({
      model: "text-embedding-v4",
      input: inputText
    });

    console.log(`Embedding request succeeded in ${Date.now() - startedAt}ms`);
    console.log(JSON.stringify(completion, null, 2));
  } catch (error) {
    if (error instanceof Error) {
      console.error('Embedding request failed:', {
        name: error.name,
        message: error.message,
        cause: error.cause,
      });
      return;
    }

    console.error('Unknown error:', error);
  }
}

getEmbedding();
