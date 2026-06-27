package com.lou.authenticationservice.service.impl;

import com.lou.authenticationservice.constants.config.OSSConstant;
import com.lou.authenticationservice.data.common.SendMail.MailRequest;
import com.lou.authenticationservice.data.common.SendMail.MailResponse;
import com.lou.authenticationservice.data.common.media.MediaUploadRequest;
import com.lou.authenticationservice.data.common.media.MediaUploadResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlRequest;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlResponse;
import com.lou.authenticationservice.service.CommonService;
import com.lou.authenticationservice.utils.OSSUtils;
import com.lou.authenticationservice.utils.RandomNumUtil;
import com.lou.authenticationservice.utils.ResendMailClient;
import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
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

    private static final long MB = 1024L * 1024L;
    /** 媒体直传 PUT URL 有效期(秒)。 */
    private static final int MEDIA_UPLOAD_EXPIRE_SEC = 900;

    @Override
    public MediaUploadResponse mediaUploadUrl(String userId, MediaUploadRequest request) {
        String contentType = request.getContentType() == null ? "" : request.getContentType().trim().toLowerCase();
        long maxSize = resolveMaxSize(contentType); // 类型不在白名单 -> 抛 422
        if (request.getSize() != null && request.getSize() > maxSize) {
            throw new ApiException(CommonError.VALIDATION_FAILED, "文件超出大小上限:" + maxSize + " bytes");
        }
        String ext = resolveExt(request.getFileName(), contentType);
        // 对象键服务端生成:用户隔离 + 日期分桶 + 随机,客户端无法指定 -> 防跨用户覆盖/路径穿越
        String objectKey = "chat/" + userId + "/" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE)
                + "/" + UUID.randomUUID().toString().replace("-", "")
                + (ext.isEmpty() ? "" : "." + ext);

        String uploadUrl = ossUtils.uploadUrl(OSSConstant.BUCKET_NAME, objectKey, MEDIA_UPLOAD_EXPIRE_SEC);
        String fileUrl = ossUtils.downUrl(OSSConstant.BUCKET_NAME, objectKey);

        return new MediaUploadResponse()
                .setUploadUrl(uploadUrl)
                .setFileUrl(fileUrl)
                .setObjectKey(objectKey)
                .setMethod("PUT")
                .setContentType(contentType)
                .setExpiresInSec(MEDIA_UPLOAD_EXPIRE_SEC)
                .setMaxSizeBytes(maxSize);
    }

    /** MIME 白名单与大小上限;不支持的类型抛 422。 */
    private long resolveMaxSize(String contentType) {
        if (contentType.startsWith("image/")) return 10 * MB;
        if (contentType.startsWith("video/")) return 100 * MB;
        if (contentType.startsWith("audio/")) return 20 * MB;
        if (contentType.equals("application/pdf")) return 20 * MB;
        throw new ApiException(CommonError.VALIDATION_FAILED, "不支持的媒体类型:" + contentType);
    }

    /** 取扩展名:优先原始文件名,回退 MIME 子类型;清洗为 [a-z0-9] 且 <=10 字符。 */
    private String resolveExt(String fileName, String contentType) {
        String ext = "";
        if (fileName != null) {
            int dot = fileName.lastIndexOf('.');
            if (dot >= 0 && dot < fileName.length() - 1) {
                ext = fileName.substring(dot + 1).toLowerCase().replaceAll("[^a-z0-9]", "");
            }
        }
        if (ext.isEmpty() && contentType.contains("/")) {
            ext = contentType.substring(contentType.indexOf('/') + 1).replaceAll("[^a-z0-9]", "");
        }
        if (ext.length() > 10) {
            ext = ext.substring(0, 10);
        }
        return ext;
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
