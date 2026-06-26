package com.lou.authenticationservice.utils;

import cn.hutool.core.util.StrUtil;
import com.qcloud.cos.COSClient;
import com.qcloud.cos.http.HttpMethodName;
import com.qcloud.cos.model.GeneratePresignedUrlRequest;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.Resource;
import java.net.URL;
import java.util.Date;

@Service
public class OSSUtils {

    @Resource
    private COSClient cosClient;

    @Value("${tencent.cos.bucket:}")
    private String configuredBucketName;

    @Value("${tencent.cos.cdn-domain:}")
    private String cdnDomain;

    @Value("${tencent.cos.public-domain:}")
    private String publicDomain;

    @SneakyThrows
    public String uploadUrl(String bucketName, String objectName, Integer expires) {
        String resolvedBucketName = resolveBucketName(bucketName);
        Date expiration = new Date(System.currentTimeMillis() + expires * 1000L);

        GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(
                resolvedBucketName,
                normalizeObjectName(objectName),
                HttpMethodName.PUT
        );
        request.setExpiration(expiration);

        URL url = cosClient.generatePresignedUrl(request);
        return url.toString();
    }

    public String downUrl(String bucketName, String fileName) {
        String downloadDomain = StringUtils.hasText(publicDomain) ? publicDomain : cdnDomain;
        if (!StringUtils.hasText(downloadDomain)) {
            throw new IllegalStateException("COS 公开访问域名未配置");
        }
        String normalizedDomain = normalizeDomain(downloadDomain);
        return normalizedDomain + StrUtil.SLASH + normalizeObjectName(fileName);
    }

    private String normalizeDomain(String domain) {
        String normalizedDomain = domain;
        if (!normalizedDomain.startsWith("http://") && !normalizedDomain.startsWith("https://")) {
            normalizedDomain = "https://" + normalizedDomain;
        }
        normalizedDomain = normalizedDomain.endsWith(StrUtil.SLASH)
                ? normalizedDomain.substring(0, normalizedDomain.length() - 1)
                : normalizedDomain;
        return normalizedDomain;
    }

    private String resolveBucketName(String bucketName) {
        String resolvedBucketName = StringUtils.hasText(configuredBucketName) ? configuredBucketName : bucketName;
        if (!StringUtils.hasText(resolvedBucketName)) {
            throw new IllegalStateException("COS Bucket 未配置");
        }
        return resolvedBucketName;
    }

    private String normalizeObjectName(String objectName) {
        if (!StringUtils.hasText(objectName)) {
            throw new IllegalArgumentException("objectName 不能为空");
        }
        while (objectName.startsWith(StrUtil.SLASH)) {
            objectName = objectName.substring(1);
        }
        return objectName;
    }

}
