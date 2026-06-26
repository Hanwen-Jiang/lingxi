package com.lou.authenticationservice.controller;

import com.lou.authenticationservice.common.Result;
import com.lou.authenticationservice.data.common.SendMail.MailRequest;
import com.lou.authenticationservice.data.common.SendMail.MailResponse;
import com.lou.authenticationservice.data.common.sms.SMSRequest;
import com.lou.authenticationservice.data.common.sms.SMSResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlResponse;
import com.lou.authenticationservice.data.common.uploadUrl.UploadUrlRequest;

import com.lou.authenticationservice.service.CommonService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.concurrent.TimeUnit;

/**
 * @ClassName CommonController
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 17:32
 */


@Slf4j
@RestController
@RequestMapping("/api/v1/user/common")
public class CommonController {

    @Autowired
    private CommonService commonService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    //    @PostMapping("/sms")
//    public Result<SMSResponse> sendSms(@RequestBody @Valid SMSRequest request) throws Exception{
//        SMSResponse response = commonService.sendSms(request);
//
//        return Result.ok(response);
//    }


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
    public String checkCode(@RequestParam String email, @RequestParam String code) {
        String redisKey = "verify:email:" + email;
        String cachedCode = redisTemplate.opsForValue().get(redisKey);

        if (cachedCode == null) {
            return "验证码已过期，请重新获取";
        }

        if (!cachedCode.equals(code)) {
            return "验证码错误";
        }

        // 验证成功，删除验证码
        redisTemplate.delete(redisKey);
        return "验证码验证成功！";
    }

    @PostMapping("/uploadUrl")
    public Result<UploadUrlResponse> getUploadUrl(@Valid UploadUrlRequest request) throws Exception {
        UploadUrlResponse response = commonService.uploadUrl(request);

        return Result.ok(response);
    }


//    @GetMapping("/getCode")
//    public BaseResponse<String> mail(@RequestParam("targetEmail") String targetEmail){
//        userService.sendMail(targetEmail);
//        return ResultUtils.success(TMSMSConstant.SMS_SEND_SUCCESS_MSG);
//    }


}