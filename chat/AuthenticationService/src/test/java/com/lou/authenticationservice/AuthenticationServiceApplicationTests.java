package com.lou.authenticationservice;

import com.lou.authenticationservice.model.User;
import com.lou.authenticationservice.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class AuthenticationServiceApplicationTests {

    @Autowired
    private UserService userService;

    @Test
    void contextLoads() {

    }

    @Test
    void testUserService(){
        User byId = userService.getById(1);
        System.out.println(byId);
    }

}
