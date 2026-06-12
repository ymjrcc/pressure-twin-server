import 'dotenv/config'
import { buildApp } from './app.js'

const app = await buildApp()

const port = Number(process.env.PORT ?? 3003)

try {
  await app.listen({
    port,
    host: '0.0.0.0'
  })

  console.log(`Server running at http://localhost:${port}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}