package com.lou.authenticationservice.conf;

import com.alibaba.fastjson.JSON;
import com.lou.authenticationservice.common.Result;
import com.lou.authenticationservice.utils.JwtUtil;
import io.jsonwebtoken.JwtException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@Slf4j
@Component
public class JwtHandler implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception{
        String authorization = request.getHeader("Authorization");
        String token = resolveToken(authorization);
        if (!StringUtils.hasText(token)){
            refuseResult(response);
            return false;
        }
        try {
            JwtUtil.parse(token);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("JWT 验签失败: {}", e.getMessage());
            refuseResult(response);
            return false;
        }

        return true;
    }

    private String resolveToken(String authorization) {
        if (!StringUtils.hasText(authorization)) {
            return null;
        }
        String trimmed = authorization.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return trimmed.substring(7).trim();
        }
        return trimmed;
    }

    public void refuseResult(HttpServletResponse httpServletResponse) throws Exception{
        httpServletResponse.setContentType("text/html;charset=UTF-8");
        httpServletResponse.setCharacterEncoding("UTF-8");
        httpServletResponse.setStatus(HttpStatus.UNAUTHORIZED.value());
        Result<Object> result = new Result<>().setCode(40101).setMsg("签名验证失败");
        httpServletResponse.getWriter().println(JSON.toJSONString(result));
        httpServletResponse.getWriter().flush();
    }
}
