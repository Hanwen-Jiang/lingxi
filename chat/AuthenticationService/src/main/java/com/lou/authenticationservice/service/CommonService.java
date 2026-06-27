package com.lou.authenticationservice.service;

import com.lou.authenticationservice.data.common.SendMail.MailRequest;
import com.lou.authenticationservice.data.common.SendMail.MailResponse;
import com.lou.authenticationservice.data.common.media.MediaUploadRequest;
import com.lou.authenticationservice.data.common.media.MediaUploadResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlRequest;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlResponse;

public interface CommonService {

    UploadUrlResponse uploadUrl(UploadUrlRequest request) throws Exception;

    /** 媒体上传预签名(M11):对象键由服务端按 userId 隔离生成,客户端无法指定。 */
    MediaUploadResponse mediaUploadUrl(String userId, MediaUploadRequest request);

    MailResponse sendMailCode(MailRequest request);
}
