package com.lou.authenticationservice.data.common.media;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 媒体上传预签名响应(03-contracts 媒体上传契约 / M11)。
 * 客户端用 {@code method}({@code uploadUrl})直传到对象存储,直传时须带 {@code Content-Type=contentType};
 * 上传成功后把 {@code fileUrl}(CDN 下载地址)写入消息体。
 */
@Data
@Accessors(chain = true)
public class MediaUploadResponse {

    /** 预签名直传 URL(默认 PUT)。 */
    private String uploadUrl;

    /** 上传完成后用于消息内容的 CDN 下载 URL。 */
    private String fileUrl;

    /** 服务端生成的对象键(用户隔离:chat/{userId}/{date}/{uuid}.{ext})。 */
    private String objectKey;

    /** 直传 HTTP 方法。 */
    private String method;

    /** 直传时必须携带的 Content-Type。 */
    private String contentType;

    /** uploadUrl 有效期(秒)。 */
    private Integer expiresInSec;

    /** 该类型大小上限(字节,advisory:对象存储预签名 PUT 无法强制,客户端须自校验)。 */
    private Long maxSizeBytes;
}
