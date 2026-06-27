package com.lou.authenticationservice.service;

import com.lou.authenticationservice.data.common.SendMail.MailRequest;
import com.lou.authenticationservice.data.common.SendMail.MailResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlRequest;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlResponse;

public interface CommonService {

    UploadUrlResponse uploadUrl(UploadUrlRequest request) throws Exception;

    MailResponse sendMailCode(MailRequest request);
}
