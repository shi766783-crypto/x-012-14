// 让 Node 能直接加载 Vite 风格的无扩展名相对导入，仅用于本地验证脚本。
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier, context.parentURL)
    for (const candidate of [`${url.href}.js`, `${url.href}/index.js`]) {
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate, context)
      }
    }
  }
  return nextResolve(specifier, context)
}
