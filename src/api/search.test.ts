import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSearchCache, searchProducts } from './openFoodFacts'

const ok = (products: unknown[]) =>
  new Response(JSON.stringify({ products }), { status: 200, headers: { 'content-type': 'application/json' } })
const product = { code: '1', product_name: 'Pilos Eidam', nutriments: { 'energy-kcal_100g': 300 } }

beforeEach(() => {
  clearSearchCache()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('searchProducts', () => {
  it('retries busy-server responses and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(ok([product]))
    vi.stubGlobal('fetch', fetchMock)
    const pending = searchProducts('eidam')
    await vi.runAllTimersAsync()
    const res = await pending
    expect(res.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('reports an error after the retries are used up', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const pending = searchProducts('eidam')
    await vi.runAllTimersAsync()
    const res = await pending
    expect(res).toEqual({ status: 'error', message: 'HTTP 503, server busy' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry client errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await searchProducts('eidam')
    expect(res).toEqual({ status: 'error', message: 'HTTP 400' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('answers an identical query from the cache, so the same input gives the same output', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok([product])).mockResolvedValue(ok([]))
    vi.stubGlobal('fetch', fetchMock)
    const first = await searchProducts('Eidam')
    const second = await searchProducts('  eidam ')
    expect(first.status === 'ok' && first.drafts.length).toBe(1)
    expect(second.status === 'ok' && second.cached && second.drafts.length).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 400 }))
      .mockResolvedValueOnce(ok([product]))
    vi.stubGlobal('fetch', fetchMock)
    expect((await searchProducts('eidam')).status).toBe('error')
    expect((await searchProducts('eidam')).status).toBe('ok')
  })

  it('stops waiting between retries when aborted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    const controller = new AbortController()
    const pending = searchProducts('eidam', { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(10)
    controller.abort()
    await assertion
  })
})
