package com.lou.authenticationservice.service.impl;

import com.lou.authenticationservice.constants.config.OSSConstant;
import com.lou.authenticationservice.data.common.SendMail.MailRequest;
import com.lou.authenticationservice.data.common.SendMail.MailResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlRequest;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlResponse;
import com.lou.authenticationservice.service.CommonService;
import com.lou.authenticationservice.utils.OSSUtils;
import com.lou.authenticationservice.utils.RandomNumUtil;
import com.lou.authenticationservice.utils.ResendMailClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

import static com.lou.authenticationservice.constants.user.registerConstant.VERIFY_EMAIL;

/**
 * @ClassName CommonServiceImpl
 * @Description 邮件验证码 / 上传地址等通用能力
 * @Author Lou
 * @Date 2025/5/30 17:37
 */

@Service
@Slf4j
@RequiredArgsConstructor
public class CommonServiceImpl implements CommonService {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private OSSUtils ossUtils;

    private final ResendMailClient mailClient;

    @Override
    public UploadUrlResponse uploadUrl(UploadUrlRequest request) throws Exception {
        String fileName = request.getFileName();

        String uploadUrl = ossUtils.uploadUrl(OSSConstant.BUCKET_NAME, fileName, OSSConstant.PICTURE_EXPIRE_TIME);
        String downUrl = ossUtils.downUrl(OSSConstant.BUCKET_NAME, fileName);

        UploadUrlResponse response = new UploadUrlResponse();
        response.setUploadUrl(uploadUrl)
                .setDownloadUrl(downUrl);

        return response;
    }

    @Async
    public void sendMail(String to, String subject, String content) {
        mailClient.sendText(to, subject, content);
    }

    @Override
    public MailResponse sendMailCode(MailRequest request) {
        String email = request.getEmail();
        String code = RandomNumUtil.getRandomNum();

        // 验证码 Redis key: verify:email:{email}
        redisTemplate.opsForValue().set(VERIFY_EMAIL + email, code, 5, TimeUnit.MINUTES);

        sendMail(email, "【测试系统】验证码",
                "您的验证码是：" + code + "，5分钟内有效。");

        return new MailResponse();
    }
}
