package com.lou.authenticationservice.service;

import com.lou.authenticationservice.data.common.SendMail.MailRequest;
import com.lou.authenticationservice.data.common.SendMail.MailResponse;
import com.lou.authenticationservice.data.common.sms.SMSRequest;
import com.lou.authenticationservice.data.common.sms.SMSResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlRequest;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlResponse;

public interface CommonService {
    SMSResponse sendSms(SMSRequest request) throws Exception;

    UploadUrlResponse uploadUrl(UploadUrlRequest request) throws Exception;

    MailResponse sendMailCode(MailRequest request);

//    void sendMail(String targetMail);
}
