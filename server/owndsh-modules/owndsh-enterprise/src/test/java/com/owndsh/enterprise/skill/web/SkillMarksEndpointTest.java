/**
 * [INPUT]: 依赖 AdminSkillController.updateMarks 的 HTTP 映射、请求头与 Sa-Token 注解（无 Spring 上下文）。
 * [OUTPUT]: 锁定标记接口契约：POST /{packageId}/marks、ent:skill:write、Idempotency-Key 与 If-Match 必需。
 * [POS]: skill/web 的标记接口静态门禁；权限注解或必需头一旦丢失，越权与 CAS 失效不会被其他测试捕获。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
package com.owndsh.enterprise.skill.web;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@Tag("dev")
class SkillMarksEndpointTest {

    private static Method updateMarks() throws NoSuchMethodException {
        return AdminSkillController.class.getMethod(
            "updateMarks", long.class, UUID.class, long.class, SkillMarksRequest.class, HttpServletRequest.class
        );
    }

    /** 标记写入口固定在包级子资源上，与 assignments/batch 同级。 */
    @Test
    void mapsToPackageScopedMarksPostEndpoint() throws Exception {
        PostMapping mapping = updateMarks().getAnnotation(PostMapping.class);
        assertNotNull(mapping, "updateMarks 必须声明 @PostMapping");
        assertArrayEquals(new String[] {"/{packageId}/marks"}, mapping.value());
    }

    /** 鉴权注解必须与同类写操作一致：ent:skill:write。 */
    @Test
    void requiresSkillWritePermission() throws Exception {
        SaCheckPermission permission = updateMarks().getAnnotation(SaCheckPermission.class);
        assertNotNull(permission, "updateMarks 必须声明 @SaCheckPermission");
        assertArrayEquals(new String[] {"ent:skill:write"}, permission.value());
    }

    /** 包级写操作的既有约定：Idempotency-Key 与 If-Match(revision) 都是必需头。 */
    @Test
    void requiresIdempotencyKeyAndIfMatchHeaders() throws Exception {
        Method method = updateMarks();

        assertEquals("Idempotency-Key", headerOn(method, 1));
        assertEquals("If-Match", headerOn(method, 2));
        assertNotNull(method.getParameters()[0].getAnnotation(PathVariable.class), "packageId 必须是路径变量");
        assertNotNull(method.getParameters()[3].getAnnotation(RequestBody.class), "标记请求体必须来自 @RequestBody");
    }

    private static String headerOn(Method method, int index) {
        RequestHeader header = method.getParameters()[index].getAnnotation(RequestHeader.class);
        assertNotNull(header, "参数 " + index + " 必须带 @RequestHeader");
        return header.value();
    }
}
