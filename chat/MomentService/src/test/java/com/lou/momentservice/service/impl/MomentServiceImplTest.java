package com.lou.momentservice.service.impl;

import com.lou.momentservice.data.createMoment.CreateMomentRequest;
import com.lou.momentservice.data.createMoment.CreateMomentResponse;
import com.lou.momentservice.model.User;
import com.lou.momentservice.model.vo.MomentVO;
import com.lou.momentservice.service.FriendService;
import com.lou.momentservice.service.MomentNotificationService;
import com.lou.momentservice.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MomentServiceImplTest {

    @Test
    void createMomentShouldReturnCreatedMomentId() throws Exception {
        TestMomentServiceImpl service = new TestMomentServiceImpl();
        FriendService friendService = mock(FriendService.class);
        UserService userService = mock(UserService.class);
        MomentNotificationService notificationService = mock(MomentNotificationService.class);
        ReflectionTestUtils.setField(service, "friendService", friendService);
        ReflectionTestUtils.setField(service, "userService", userService);
        ReflectionTestUtils.setField(service, "momentNotificationService", notificationService);
        User user = new User();
        user.setAvatar("avatar.png");
        when(userService.getById(1L)).thenReturn(user);
        when(friendService.getFriendIds(1L)).thenReturn(List.of(2L, 3L));

        CreateMomentRequest request = new CreateMomentRequest()
                .setUserId("1")
                .setText("hello")
                .setMediaUrls(List.of("a.png"));

        CreateMomentResponse response = service.createMoment(request);

        assertThat(response.getMomentId()).isEqualTo(99L);
        assertThat(response.getUserId()).isEqualTo(1L);
        assertThat(response.getText()).isEqualTo("hello");
        assertThat(response.getMediaUrls()).containsExactly("a.png");
        verify(notificationService).sendMomentCreationNotification(1L, "avatar.png", 99L, List.of(2L, 3L));
    }

    private static class TestMomentServiceImpl extends MomentServiceImpl {
        @Override
        public MomentVO saveMoment(Long userId, String text, List<String> urls) {
            return new MomentVO()
                    .setMomentId(99L)
                    .setUserId(userId)
                    .setText(text)
                    .setMediaUrls(urls);
        }
    }
}
