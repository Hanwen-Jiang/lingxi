package com.lou.authenticationservice.utils;

import java.util.Random;

/**
 * @ClassName RandomNumUtil
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 17:38
 */


public class RandomNumUtil {
    public static String getRandomNum() {
        Random random = new Random();

        int num = random.nextInt(900000) + 100000;
        return String.format("%06d", num);
    }
}
