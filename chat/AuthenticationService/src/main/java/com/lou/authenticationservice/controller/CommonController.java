package com.lou.authenticationservice.controller;

import com.lou.common.api.Result;
import com.lou.common.security.RequestContext;
import com.lou.authenticationservice.data.common.SendMail.MailRequest;
import com.lou.authenticationservice.data.common.SendMail.MailResponse;
import com.lou.authenticationservice.data.common.media.MediaUploadRequest;
import com.lou.authenticationservice.data.common.media.MediaUploadResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlRequest;

import com.lou.authenticationservice.service.CommonService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

import static com.lou.authenticationservice.constants.user.registerConstant.VERIFY_EMAIL;

/**
 * @ClassName CommonController
 * @Description 验证码 / 上传地址等通用端点(D14:邮箱验证码)
 * @Author Lou
 * @Date 2025/5/30 17:32
 */


@Slf4j
@RestController
@RequestMapping("/api/v1/user")
public class CommonController {

    @Autowired
    private CommonService commonService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    /**
     * 发送邮箱验证码
     */
    @PostMapping("/sendMail")
    public Result<MailResponse> sendMailCode(@RequestBody @Valid MailRequest request) {
        MailResponse response = commonService.sendMailCode(request);
        return Result.ok(response);
    }

    /**
     * 校验验证码
     */
    @PostMapping("/check")
    public Result<String> checkCode(@RequestParam String email, @RequestParam String code) {
        String redisKey = VERIFY_EMAIL + email;
        String cachedCode = redisTemplate.opsForValue().get(redisKey);

        if (cachedCode == null) {
            return Result.ok("验证码已过期，请重新获取");
        }

        if (!cachedCode.equals(code)) {
            return Result.ok("验证码错误");
        }

        // 验证成功，删除验证码
        redisTemplate.delete(redisKey);
        return Result.ok("验证码验证成功！");
    }

    @PostMapping("/uploadUrl")
    public Result<UploadUrlResponse> getUploadUrl(@Valid UploadUrlRequest request) throws Exception {
        UploadUrlResponse response = commonService.uploadUrl(request);

        return Result.ok(response);
    }

    /**
     * 媒体上传预签名(M11):需登录(网关注入 X-User-Id)。对象键由服务端按当前用户隔离生成,
     * 客户端只给原始文件名(取扩展名)+ contentType。返回直传 URL + 上传后用于消息的 CDN URL。
     */
    @PostMapping("/media/upload-url")
    public Result<MediaUploadResponse> getMediaUploadUrl(@RequestBody @Valid MediaUploadRequest request) {
        String userId = RequestContext.requireUserId();
        return Result.ok(commonService.mediaUploadUrl(userId, request));
    }

}
