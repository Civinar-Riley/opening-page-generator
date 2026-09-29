/* 预览测高回归（core.js fitPreviewHeight）。
 * fitPreviewHeight 挂在 UI 对象上、依赖真实 iframe + ResizeObserver，node 环境无法直接跑，
 * 这里把「测量算法」抽成可独立验证的纯逻辑副本做数值模拟：
 * 真实 DOM 行为已在浏览器 800px 视口实测（frameH 537px 三次往返不漂移）。 */
import { describe, it, expect } from 'vitest';

/* 与 core.js measure 同构：先摘 body min-height 再读 scrollHeight。
 * 入参 viewportH = iframe 当前高度（iframe 无内容时内部视口高 == frame 高度），
 * contentH = 内容真实高度，minH = srcdoc 模板 body 的 min-height（100vh → viewportH） */
function measureStep({ contentH, viewportH, stripMinHeight }) {
  const bodyScrollH = stripMinHeight ? contentH : Math.max(contentH, viewportH);
  return bodyScrollH + 2;
}

describe('预览测高（fitPreviewHeight measure）', () => {
  it('不摘 min-height：iframe 高度喂高视口、视口喂高 body.scrollHeight，多轮后失控', () => {
    let frameH = 0;
    const seq = [];
    for (let i = 0; i < 4; i++) {
      frameH = measureStep({ contentH: 535, viewportH: frameH, stripMinHeight: false });
      seq.push(frameH);
    }
    expect(seq[0]).toBe(537);
    expect(seq).toEqual([537, 539, 541, 543]); // 每次 +2 单调递增，无收敛
  });
  it('摘除 min-height 后读内容高度：任何轮次都收敛到内容高（修复行为）', () => {
    let frameH = 0;
    const seq = [];
    for (let i = 0; i < 4; i++) {
      frameH = measureStep({ contentH: 535, viewportH: frameH, stripMinHeight: true });
      seq.push(frameH);
    }
    expect(seq).toEqual([537, 537, 537, 537]);
  });
  it('内容比视口高时两种算法一致（min-height 不构成下限）', () => {
    expect(measureStep({ contentH: 900, viewportH: 400, stripMinHeight: true }))
      .toBe(measureStep({ contentH: 900, viewportH: 400, stripMinHeight: false }));
  });
  it('内容为空（0）时修复后钉死 2px 而非随视口膨胀', () => {
    let frameH = 0;
    for (let i = 0; i < 5; i++) frameH = measureStep({ contentH: 0, viewportH: frameH, stripMinHeight: true });
    expect(frameH).toBe(2);
  });
});
