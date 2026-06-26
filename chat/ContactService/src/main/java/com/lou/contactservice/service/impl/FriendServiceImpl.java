package com.lou.contactservice.service.impl;

import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.github.yulichang.wrapper.MPJLambdaWrapper;
import com.lou.contactservice.constants.ConfigEnum;
import com.lou.contactservice.constants.FriendServiceConstants;
import com.lou.contactservice.constants.SessionType;
import com.lou.contactservice.data.BlockFriend.BlockFriendRequest;
import com.lou.contactservice.data.BlockFriend.BlockFriendResponse;
import com.lou.contactservice.data.DeleteFriend.DeleteFriendRequest;
import com.lou.contactservice.data.DeleteFriend.DeleteFriendResponse;
import com.lou.contactservice.data.FriendDetail.FriendDetailRequest;
import com.lou.contactservice.data.FriendDetail.FriendDetailResponse;
import com.lou.contactservice.data.ModifyApply.ModifyApplyResponse;
import com.lou.contactservice.data.SearchUser.SearchUserRequest;
import com.lou.contactservice.data.SearchUser.SearchUserResponse;
import com.lou.contactservice.data.dto.push.NewSessionNotification;
import com.lou.contactservice.exception.ServiceException;
import com.lou.contactservice.exception.ServiceUnavailableException;
import com.lou.contactservice.mapper.ApplyFriendMapper;
import com.lou.contactservice.mapper.SessionMapper;
import com.lou.contactservice.mapper.UserSessionMapper;
import com.lou.contactservice.model.*;
import com.lou.contactservice.service.FriendService;
import com.lou.contactservice.mapper.FriendMapper;
import com.lou.contactservice.service.PushService;
import com.lou.contactservice.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.util.ArrayList;
import java.util.List;

/**
 * @author Lou
 * @description 针对表【friend(联系人表)】的数据库操作Service实现
 * @createDate 2025-06-26 19:57:12
 */
@Service
@Slf4j
public class FriendServiceImpl extends ServiceImpl<FriendMapper, Friend>
        implements FriendService {

    @Autowired
    private UserService userService;

    @Autowired
    private UserSessionMapper userSessionMapper;

    @Autowired
    private ApplyFriendMapper applyFriendMapper;

    @Autowired
    private SessionMapper sessionMapper;

    private final Snowflake snowflake = IdUtil.getSnowflake(
            Integer.parseInt(ConfigEnum.WORKED_ID.getValue()),
            Integer.parseInt(ConfigEnum.DATACENTER_ID.getValue())
    );
    @Autowired
    private PushService pushService;

    @Override
    public SearchUserResponse getUserDetails(SearchUserRequest request) {
        QueryWrapper<User> userQueryWrapper = new QueryWrapper<>();

        userQueryWrapper.eq("phone", request.getPhone());

        User user = userService.getOne(userQueryWrapper);

        if (user == null) {
            throw new ServiceUnavailableException(FriendServiceConstants.USER_NOT_EXIST);
        }

        validateFriendUser(user);

        SearchUserResponse response = new SearchUserResponse();
        response.setUserUuid(user.getUserId())
                .setNickname(user.getUserName())
                .setAvatar(user.getAvatar())
                .setEmail(user.getEmail())
                .setPhone(user.getPhone())
                .setSignature(user.getSignature())
                .setGender(user.getGender());

        populateSessionId(Long.valueOf(request.getUserUuid()), user.getUserId(), response);
        populateFriendStatus(Long.valueOf(request.getUserUuid()), user.getUserId(), response);

        return response;
    }

    @Override
    @Transactional
    public DeleteFriendResponse deleteFriend(DeleteFriendRequest request) {
        Long userId = request.getUserUuid();
        Long friendId = request.getReceiveUserUuid();

        deleteApplyFriendRecords(userId, friendId);
        deleteFriendRecords(userId, friendId);
        deleteSessionRecords(userId, friendId);

        return new DeleteFriendResponse().setMessage("删除好友成功");
    }

    @Override
    @Transactional
    public BlockFriendResponse blockFriend(BlockFriendRequest request) {
        QueryWrapper<Friend> friendQueryWrapper = new QueryWrapper<>();
        friendQueryWrapper.eq("user_id", request.getUserUuid())
                .eq("friend_id", request.getReceiveUserUuid());

        Friend friend = this.getOne(friendQueryWrapper);
        if (friend == null) {
            throw new ServiceException(FriendServiceConstants.FRIEND_NOT_EXIST);
        }

        friend.setStatus(FriendServiceConstants.FRIEND_STATUS_BLOCKED);
        this.updateById(friend);

        return new BlockFriendResponse().setMessage("拉黑好友成功");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ModifyApplyResponse addFriend(Long userId, Long friendId) throws Exception {
        User user = userService.getById(userId);
        User applicant = userService.getById(friendId);

        createFriendRelations(userId, friendId);
        Long sessionId = createSession(userId, friendId);
        createUserSessions(userId, friendId, sessionId);
        sendPushNotification(user, friendId, sessionId);

        return buildModifyFriendApplicationResponse(applicant, sessionId);
    }

    @Override
    public FriendDetailResponse getFriendDetails(FriendDetailRequest request) {
        User friendUser = userService.getById(request.getFriendUuid());
        validateFriendUser(friendUser);

        FriendDetailResponse response = new FriendDetailResponse();
        response.setUserUuid(String.valueOf(friendUser.getUserId()))
                .setNickname(friendUser.getUserName())
                .setAvatar(friendUser.getAvatar())
                .setEmail(friendUser.getEmail())
                .setPhone(friendUser.getPhone())
                .setSignature(friendUser.getSignature())
                .setGender(friendUser.getGender())
                .setSessionId(populateSessionId(request.getUserUuid(), request.getFriendUuid()))
                .setStatus(populateFriendStatus(request.getUserUuid(), request.getFriendUuid()));

        return response;
    }

    // getUserDetails
    private void validateFriendUser(User friendUser) {
        switch (friendUser.getStatus()) {
            case FriendServiceConstants.USER_STATUS_BANNED:
                throw new ServiceException(FriendServiceConstants.USER_BANNED);
            case FriendServiceConstants.USER_STATUS_DELETED:
                throw new ServiceException(FriendServiceConstants.USER_DELETED);
            default:
                break;
        }
    }


    private void populateSessionId(Long userId, Long friendId, SearchUserResponse response) {
        List<Long> commonSessionIds = userSessionMapper.findCommonSingleChatSessionIds(userId, friendId);
        if (commonSessionIds == null || commonSessionIds.isEmpty()) {
            response.setSessionId(null);
        } else {
            response.setSessionId(String.valueOf(commonSessionIds.get(0)));
        }
    }

    private void populateFriendStatus(Long userId, Long friendId, SearchUserResponse response) {
        QueryWrapper<Friend> wrapper = new QueryWrapper<>();
        wrapper.eq("friend_id", friendId)
                .eq("user_id", userId);
        Friend friend = this.getOne(wrapper);
        if (friend != null) {
            response.setStatus(friend.getStatus());
        } else {
            response.setStatus(FriendServiceConstants.FRIEND_STATUS_NON_FRIEND);
        }
    }


    // deleteFriend
    private void deleteApplyFriendRecords(Long userId, Long friendId) {
        QueryWrapper<ApplyFriend> applyFriendQueryWrapper = new QueryWrapper<>();
        applyFriendQueryWrapper.nested(wrapper -> wrapper.eq("user_id", userId).eq("target_id", friendId))
                .or()
                .nested(wrapper -> wrapper.eq("user_id", friendId).eq("target_id", userId));
        applyFriendMapper.delete(applyFriendQueryWrapper);
    }

    private void deleteFriendRecords(Long userId, Long friendId) {
        QueryWrapper<Friend> friendQueryWrapper = new QueryWrapper<>();
        friendQueryWrapper.nested(wrapper -> wrapper.eq("user_id", userId).eq("friend_id", friendId))
                .or()
                .nested(wrapper -> wrapper.eq("user_id", friendId).eq("friend_id", userId));
        this.remove(friendQueryWrapper);
    }

    private void deleteSessionRecords(Long userId, Long friendId) {
        MPJLambdaWrapper<Session> wrapper = new MPJLambdaWrapper<Session>()
                .select(Session::getId)
                .eq(Session::getType, 1)
                .eq(Session::getStatus, 1)
                .leftJoin(UserSession.class, UserSession::getSessionId, Session::getId)
                .leftJoin(UserSession.class, UserSession::getSessionId, Session::getId)
                .eq("t1.user_id", userId)
                .eq("t2.user_id", friendId);

        List<Session> sessions = sessionMapper.selectJoinList(Session.class, wrapper);
        ArrayList<Long> sessionIdList = new ArrayList<>();

        for (Session session : sessions) {
            sessionIdList.add(session.getId());
        }

        if (!sessions.isEmpty()) {
            QueryWrapper<UserSession> userSessionQueryWrapper = new QueryWrapper<>();
            userSessionQueryWrapper.in("session_id", sessionIdList);

            userSessionMapper.delete(userSessionQueryWrapper);
            sessionMapper.deleteBatchIds(sessionIdList);
        }
    }


    // addFriend
    private void createFriendRelations(Long userId, Long friendId) {
        Friend friend1 = new Friend();
        friend1.setId(snowflake.nextId());
        friend1.setUserId(userId);
        friend1.setFriendId(friendId);
        friend1.setStatus(FriendServiceConstants.FRIEND_STATUS_ACTIVE);

        Friend friend2 = new Friend();
        friend2.setId(snowflake.nextId());
        friend2.setUserId(friendId);
        friend2.setFriendId(userId);
        friend2.setStatus(FriendServiceConstants.FRIEND_STATUS_ACTIVE);

        boolean save1 = this.save(friend1);
        boolean save2 = this.save(friend2);

        if (!save1 || !save2) {
            throw new ServiceException(FriendServiceConstants.ADD_FRIEND_FAILED);
        }
    }

    private Long createSession(Long userId, Long friendId) {
        Long sessionId = snowflake.nextId();
        Session session = new Session();
        session.setId(sessionId);
        session.setName(FriendServiceConstants.EMPTY_STRING);
        session.setType(SessionType.SINGLE.getValue());
        session.setStatus(FriendServiceConstants.FRIEND_STATUS_ACTIVE);

        int sessionSaved = sessionMapper.insert(session);
        if (sessionSaved <= 0) {
            throw new ServiceException(FriendServiceConstants.CREATE_SESSION_FAILED);
        }
        return sessionId;
    }

    private void createUserSessions(Long userId, Long friendId, Long sessionId) {
        UserSession userSession1 = new UserSession();
        userSession1.setId(snowflake.nextId())
                .setUserId(userId)
                .setSessionId(sessionId)
                .setRole(FriendServiceConstants.USER_ROLE_NORMAL)
                .setStatus(FriendServiceConstants.FRIEND_STATUS_ACTIVE);

        UserSession userSession2 = new UserSession();
        userSession2.setId(snowflake.nextId())
                .setUserId(friendId)
                .setSessionId(sessionId)
                .setRole(FriendServiceConstants.USER_ROLE_NORMAL)
                .setStatus(FriendServiceConstants.FRIEND_STATUS_ACTIVE);

        int userSessionSaved1 = userSessionMapper.insert(userSession1);
        int userSessionSaved2 = userSessionMapper.insert(userSession2);

        if (userSessionSaved1 <= 0 || userSessionSaved2 <= 0) {
            throw new ServiceException(FriendServiceConstants.CREATE_USER_SESSION_FAILED);
        }
    }

    private void sendPushNotification(User recipient, Long friendId, Long sessionId) throws Exception {
        NewSessionNotification notification = new NewSessionNotification();
        notification.setUserId(String.valueOf(recipient.getUserId()))
                .setSessionId(String.valueOf(sessionId))
                .setSessionType(SessionType.SINGLE.getValue())
                .setSessionName(recipient.getUserName())
                .setAvatar(recipient.getAvatar());

        pushService.pushNewSession(friendId, notification);
    }

    private ModifyApplyResponse buildModifyFriendApplicationResponse(User applicant, Long sessionId) {
        ModifyApplyResponse response = new ModifyApplyResponse();
        response.setUserId(String.valueOf(applicant.getUserId()));
        response.setSessionId(String.valueOf(sessionId));
        response.setSessionType(SessionType.SINGLE.getValue());
        response.setSessionName(applicant.getUserName());
        response.setAvatar(applicant.getAvatar());
        return response;
    }


    // getFriendDetails
    private String populateSessionId(Long userId, Long friendId) {
        List<Long> commonSessionIds = userSessionMapper.findCommonSingleChatSessionIds(userId, friendId);
        if (commonSessionIds == null || commonSessionIds.isEmpty()) {
            return "0";
        } else {
            return String.valueOf(commonSessionIds.get(0));
        }
    }

    private int populateFriendStatus(Long userId, Long friendId) {
        QueryWrapper<Friend> wrapper = new QueryWrapper<>();
        wrapper.eq("friend_id", friendId)
                .eq("user_id", userId);
        Friend friend = this.getOne(wrapper);
        if (friend != null) {
            return friend.getStatus();
        } else {
            return FriendServiceConstants.FRIEND_STATUS_NON_FRIEND;
        }
    }
}





