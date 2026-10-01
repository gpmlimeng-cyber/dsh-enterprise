/**
 * [INPUT]: 依赖 RuntimeSkillController 内嵌的 ByteRange.parse 纯函数（无 DB、无 Spring 上下文）。
 * [OUTPUT]: 锁定单段 Range 的解析与边界：整段/开区间/后缀/越界/畸形/夹紧与 partial 判定。
 * [POS]: skill/web 的字节范围门禁；下载路径的正确性完全落在这个纯函数上，故必须有独立测试。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("dev")
class RuntimeSkillByteRangeTest {

    private static RuntimeSkillController.ByteRange parse(String header, long size) {
        return RuntimeSkillController.ByteRange.parse(header, size);
    }

    /** 无 Range 或空白：整段返回，且不得被当成部分响应。 */
    @Test
    void returnsWholeArtifactWhenNoRangeIsGiven() {
        RuntimeSkillController.ByteRange range = parse(null, 1000);
        assertEquals(0, range.start());
        assertEquals(999, range.end());
        assertFalse(range.partial());
        assertEquals(1000, range.length());

        RuntimeSkillController.ByteRange blank = parse("   ", 1000);
        assertFalse(blank.partial());
        assertEquals(1000, blank.length());
    }

    /** 开区间、闭区间与"恰好整段"的 partial 判定。 */
    @Test
    void parsesOpenAndClosedRangesInclusively() {
        RuntimeSkillController.ByteRange open = parse("bytes=100-", 1000);
        assertEquals(100, open.start());
        assertEquals(999, open.end());
        assertTrue(open.partial());
        assertEquals(900, open.length());

        RuntimeSkillController.ByteRange closed = parse("bytes=0-99", 1000);
        assertEquals(0, closed.start());
        assertEquals(99, closed.end());
        assertTrue(closed.partial());
        assertEquals(100, closed.length());

        // bytes=0- 恰好等于整段：partial 必须是 false，否则客户端会走 206 分支。
        assertFalse(parse("bytes=0-", 1000).partial());
    }

    /** 后缀 Range 从尾部起算；超过总长时退化为整段。 */
    @Test
    void resolvesSuffixRangesFromTheEnd() {
        RuntimeSkillController.ByteRange suffix = parse("bytes=-100", 1000);
        assertEquals(900, suffix.start());
        assertEquals(999, suffix.end());
        assertTrue(suffix.partial());

        RuntimeSkillController.ByteRange oversized = parse("bytes=-5000", 1000);
        assertEquals(0, oversized.start());
        assertEquals(999, oversized.end());
        assertFalse(oversized.partial());
    }

    /** 结束位置超过总长时夹紧到末尾。 */
    @Test
    void clampsEndBeyondSize() {
        RuntimeSkillController.ByteRange clamped = parse("bytes=0-5000", 1000);
        assertEquals(0, clamped.start());
        assertEquals(999, clamped.end());
        assertFalse(clamped.partial());
    }

    /** 越界与逆序一律拒绝。 */
    @Test
    void rejectsOutOfBoundsAndInvertedRanges() {
        assertThrows(IllegalArgumentException.class, () -> parse("bytes=1000-", 1000));
        assertThrows(IllegalArgumentException.class, () -> parse("bytes=100-99", 1000));
        assertThrows(IllegalArgumentException.class, () -> parse("bytes=-0", 1000));
    }

    /** 畸形单位与多段 Range 一律拒绝（只支持单一 bytes 段）。 */
    @Test
    void rejectsMalformedAndMultiPartRanges() {
        assertThrows(IllegalArgumentException.class, () -> parse("bytes=-", 1000));
        assertThrows(IllegalArgumentException.class, () -> parse("bytes=0-1,5-6", 1000));
        assertThrows(IllegalArgumentException.class, () -> parse("items=0-1", 1000));
        assertThrows(IllegalArgumentException.class, () -> parse("0-1", 1000));
    }

    /** 总长非正一律拒绝。 */
    @Test
    void rejectsNonPositiveSize() {
        assertThrows(IllegalArgumentException.class, () -> parse(null, 0));
        assertThrows(IllegalArgumentException.class, () -> parse("bytes=0-1", -1));
    }
}
