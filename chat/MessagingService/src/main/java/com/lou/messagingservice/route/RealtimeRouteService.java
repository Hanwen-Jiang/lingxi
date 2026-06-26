package com.lou.messagingservice.route;

import com.lou.messagingservice.constants.UserConstants;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class RealtimeRouteService {

    private final RedisTemplate<String, String> redisTemplate;

    public RealtimeRouteService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public String getActualRoute(Long userId) {
        if (userId == null) {
            return null;
        }
        return redisTemplate.opsForValue().get(UserConstants.USER_SESSION + userId);
    }

    public Map<String, List<Long>> groupUsersByRoute(List<Long> userIds) {
        Map<String, List<Long>> routeMap = new LinkedHashMap<>();
        if (userIds == null || userIds.isEmpty()) {
            return routeMap;
        }

        for (Long userId : userIds) {
            String route = getActualRoute(userId);
            if (route == null || route.trim().isEmpty()) {
                log.info("用户{}无Redis在线路由，判定为离线，不进行实时推送", userId);
                continue;
            }
            routeMap.computeIfAbsent(normalizeRoute(route), key -> new ArrayList<>()).add(userId);
        }
        return routeMap;
    }

    public void removeRouteIfMatch(Long userId, String route) {
        if (userId == null || route == null) {
            return;
        }
        String key = UserConstants.USER_SESSION + userId;
        String currentRoute = redisTemplate.opsForValue().get(key);
        if (currentRoute != null && normalizeRoute(currentRoute).equals(normalizeRoute(route))) {
            redisTemplate.delete(key);
            log.info("清理失效实时路由，userId: {}, route: {}", userId, currentRoute);
        }
    }

    private String normalizeRoute(String route) {
        String trimmed = route.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        return "http://" + trimmed;
    }

}
