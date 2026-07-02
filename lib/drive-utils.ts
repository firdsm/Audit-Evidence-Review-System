export function matchAspectFolder(
  sortedAspectFolders: Array<{ id?: string | null; name?: string | null }>,
  aspectOrderNumber: number
): { id: string; name: string } | null {
  let matched = sortedAspectFolders.find(f => {
    const m = (f.name || '').match(/^(\d+)/)
    return m ? parseInt(m[1], 10) === aspectOrderNumber : false
  })

  if (!matched && aspectOrderNumber - 1 < sortedAspectFolders.length) {
    matched = sortedAspectFolders[aspectOrderNumber - 1]
  }

  if (matched && matched.id && matched.name) {
    return { id: matched.id, name: matched.name }
  }
  return null
}
