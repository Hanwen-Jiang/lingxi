package com.lou.authenticationservice.data.common.media;

import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.NotEmpty;

/**
 * 媒体上传预签名请求(03-contracts 媒体上传契约 / M11)。
 * 客户端只提供原始文件名(取扩展名)与 MIME 类型;对象键由服务端按用户隔离生成,
 * 客户端无法指定对象键,杜绝跨用户覆盖与路径穿越。
 */
@Data
@Accessors(chain = true)
public class MediaUploadRequest {

    /** 原始文件名,仅用于推断扩展名(不作为对象键)。 */
    @NotEmpty(message = "fileName 不能为空")
    private String fileName;

    /** MIME 类型,如 image/jpeg、video/mp4;按白名单校验。 */
    @NotEmpty(message = "contentType 不能为空")
    private String contentType;

    /** 可选:字节数。提供则校验不超过该类型上限。 */
    private Long size;
}
