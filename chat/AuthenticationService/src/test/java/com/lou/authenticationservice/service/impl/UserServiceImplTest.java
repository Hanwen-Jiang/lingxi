package com.lou.authenticationservice.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.lou.authenticationservice.data.user.updateAvatar.UpdateAvatarRequest;
import com.lou.authenticationservice.data.user.updateAvatar.UpdateAvatarResponse;
import com.lou.authenticationservice.model.User;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserServiceImplTest {

    @Test
    void updateAvatarShouldReturnUpdatedUserInfo() {
        TestUserServiceImpl service = new TestUserServiceImpl();
        service.user = new User()
                .setUserId(1L)
                .setUserName("Lou")
                .setAvatar("old.png");
        UpdateAvatarRequest request = new UpdateAvatarRequest();
        request.avatarUrl = "new.png";

        UpdateAvatarResponse response = service.updateAvatar("1", request);

        assertThat(response).isNotNull();
        assertThat(response.getUserId()).isEqualTo(1L);
        assertThat(response.getUserName()).isEqualTo("Lou");
        assertThat(response.getAvatar()).isEqualTo("new.png");
        assertThat(service.updatedUser.getAvatar()).isEqualTo("new.png");
    }

    private static class TestUserServiceImpl extends UserServiceImpl {
        private User user;
        private User updatedUser;

        @Override
        public User getOne(Wrapper<User> queryWrapper, boolean throwEx) {
            return user;
        }

        @Override
        public boolean updateById(User entity) {
            this.updatedUser = entity;
            return true;
        }
    }
}
