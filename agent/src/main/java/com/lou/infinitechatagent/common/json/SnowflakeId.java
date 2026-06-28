package com.lou.infinitechatagent.common.json;

import com.fasterxml.jackson.annotation.JacksonAnnotationsInside;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * D5(契约 §5):JSON 内所有 snowflake id 一律 <b>string 化</b>。
 *
 * <p>标注在 {@code Long} 类型的 id 字段上(userId / sessionId / messageId / 审计行 id 等):
 * <ul>
 *   <li><b>出参(序列化)</b>:Long → JSON string(用 {@link ToStringSerializer});{@code null} 仍序列化为
 *       {@code null}(配合全局 {@code non_null} 被省略),不会输出 {@code "null"} 字符串。</li>
 *   <li><b>入参(反序列化)</b>:不改默认行为——Jackson 的 {@code Long} 反序列化器本就同时接受 JSON
 *       数字 {@code 123} 与字符串 {@code "123"}(标量强制),天然满足 expand/contract 的
 *       <b>双读过渡</b>:老前端发数字、新前端发字符串都能解析。</li>
 * </ul>
 *
 * <p><b>只用于 id 字段</b>——时间戳(epoch millis)、计数、分数、token 数等非 id 的数值<b>不得</b>标注,
 * 以免被误转成字符串(契约 §5 与本轮 P5 交接 S2 的明确边界)。
 */
@JacksonAnnotationsInside
@JsonSerialize(using = ToStringSerializer.class)
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface SnowflakeId {
}
