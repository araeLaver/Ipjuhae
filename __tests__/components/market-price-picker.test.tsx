// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MarketPricePicker } from '@/components/market-price-picker'

const trades = ['A', 'B'].map((name, i) => ({ name, areaM2: 84, priceManwon: 50000 + i * 10000, floor: 3, dealtAt: '2026-09-01', dong: '', buildYear: 2000 }))
const pending: { resolve: (value: Response) => void; reject: (error: Error) => void }[] = []
let oncomplete: (data: { bcode: string; sido: string; sigungu: string }) => void
const loading = '같은 단지 전세를 찾는 중입니다'
const reference = (name: string) => `${name} 84㎡ 전세 실거래`

beforeEach(() => {
  pending.length = 0
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve, reject) => pending.push({ resolve, reject }))))
  vi.stubGlobal('daum', { Postcode: class {
    constructor(options: { oncomplete: typeof oncomplete }) { oncomplete = options.oncomplete }
    open() {}
  } })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function region(code = '1111010100') {
  fireEvent.click(screen.getByRole('button', { name: /주소로 지역 찾기|다시 고르기/ }))
  act(() => oncomplete({ bcode: code, sido: '서울', sigungu: code }))
}
async function respond(index: number, body: object) {
  await act(async () => pending[index].resolve(new Response(JSON.stringify(body))))
}
function rent(name: string) {
  return { jeonse: [{ name, areaM2: 84, depositManwon: name === 'A' ? 30000 : 40000, dealtAt: '2026-09-01' }] }
}
async function setup() {
  const onPick = vi.fn()
  render(<MarketPricePicker onPick={onPick} />)
  region()
  fireEvent.click(screen.getByRole('button', { name: '찾기' }))
  await respond(0, { trades })
  return onPick
}
function pick(name: string) { fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) })) }

it('A→B 선택 후 B→A 응답이 와도 B의 매매 입력과 전세만 유지한다', async () => {
  const onPick = await setup()
  pick('A'); pick('B')
  await respond(2, rent('B'))
  await respond(1, rent('A'))
  expect(onPick).toHaveBeenLastCalledWith(60000)
  expect(screen.getByText(reference('B'))).toBeInTheDocument()
  expect(screen.queryByText(reference('A'))).toBeNull()
})

it.each(['성공', '실패'])('이전 요청의 %s 완료는 최신 요청의 loading을 해제하지 않는다', async (outcome) => {
  await setup()
  pick('A'); pick('B')
  if (outcome === '성공') await respond(1, rent('A'))
  else await act(async () => pending[1].reject(new Error('network')))
  expect(screen.getByText(loading)).toBeInTheDocument()
  expect(screen.queryByText(reference('A'))).toBeNull()
  await respond(2, rent('B'))
  expect(screen.queryByText(loading)).toBeNull()
  expect(screen.getByText(reference('B'))).toBeInTheDocument()
})

for (const transition of ['주소', '검색어', '재검색']) {
  const change = () => {
    if (transition === '주소') region('1168010100')
    else if (transition === '검색어') fireEvent.change(screen.getByLabelText('단지 이름 (선택)'), { target: { value: '새 단지' } })
    else fireEvent.click(screen.getByRole('button', { name: '찾기' }))
  }
  it(`${transition} 변경은 진행 중 전세 응답을 무효화한다`, async () => {
    await setup(); pick('A'); change()
    expect(screen.queryByText(loading)).toBeNull()
    await respond(1, rent('A'))
    expect(screen.queryByText(reference('A'))).toBeNull()
  })
  it(`${transition} 변경은 표시된 전세 참고값을 즉시 숨긴다`, async () => {
    await setup(); pick('A'); await respond(1, rent('A'))
    expect(screen.getByText(reference('A'))).toBeInTheDocument()
    change()
    expect(screen.queryByText(reference('A'))).toBeNull()
  })
}

it('주소 변경 전 매매 응답은 새 검색의 목록과 loading을 변경하지 않는다', async () => {
  render(<MarketPricePicker onPick={vi.fn()} />)
  region()
  fireEvent.click(screen.getByRole('button', { name: '찾기' }))
  region('1168010100')
  fireEvent.click(screen.getByRole('button', { name: '찾기' }))
  await respond(0, { trades })
  expect(screen.getByRole('button', { name: '찾는 중' })).toBeDisabled()
  expect(screen.queryByText('A')).toBeNull()
  await respond(1, { trades: [trades[1]] })
  expect(screen.getByText('B')).toBeInTheDocument()
  expect(screen.queryByText('A')).toBeNull()
})
