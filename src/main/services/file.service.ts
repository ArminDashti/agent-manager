import { readFile, writeFile, readdir, stat, mkdir, copyFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { basename, dirname, extname, join } from 'path'

export class FileService {
  async readText(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8')
  }

  async writeText(filePath: string, content: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }

  async listFilesRecursive(dir: string): Promise<string[]> {
    if (!existsSync(dir)) return []

    const results: string[] = []
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...(await this.listFilesRecursive(full)))
      } else {
        results.push(full)
      }
    }

    return results
  }

  async listDirectories(dir: string): Promise<string[]> {
    if (!existsSync(dir)) return []
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => join(dir, e.name))
  }

  async copyDirectory(src: string, dest: string): Promise<void> {
    if (!existsSync(src)) return
    await mkdir(dest, { recursive: true })
    const entries = await readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await mkdir(dirname(destPath), { recursive: true })
        await copyFile(srcPath, destPath)
      }
    }
  }

  async removePath(target: string): Promise<void> {
    if (!existsSync(target)) return
    const info = await stat(target)
    if (info.isDirectory()) {
      await rm(target, { recursive: true, force: true })
    } else {
      await rm(target, { force: true })
    }
  }

  fileName(path: string): string {
    return basename(path)
  }

  extension(path: string): string {
    return extname(path).toLowerCase()
  }
}

export const fileService = new FileService()
