package com.lou.authenticationservice.conf;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSCredentials;
import com.qcloud.cos.region.Region;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
public class CosConfig {

    @Value("${tencent.cos.region}")
    private String region;

    @Value("${tencent.cos.secret-id}")
    private String secretId;

    @Value("${tencent.cos.secret-key}")
    private String secretKey;

    @Bean(destroyMethod = "shutdown")
    public COSClient cosClient() {
        if (!StringUtils.hasText(secretId)) {
            throw new IllegalStateException("腾讯云 COS SecretId 未配置");
        }
        if (!StringUtils.hasText(secretKey)) {
            throw new IllegalStateException("腾讯云 COS SecretKey 未配置");
        }

        COSCredentials credentials = new BasicCOSCredentials(secretId, secretKey);
        ClientConfig clientConfig = new ClientConfig(new Region(region));
        return new COSClient(credentials, clientConfig);
    }
}
