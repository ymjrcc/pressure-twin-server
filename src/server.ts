import 'dotenv/config'
import { buildApp } from './app.js'
import { env } from './config/env.js'

const app = await buildApp()

try {
  await app.listen({
    port: env.port,
    host: '0.0.0.0'
  })

  console.log(`Server running at http://localhost:${env.port}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
