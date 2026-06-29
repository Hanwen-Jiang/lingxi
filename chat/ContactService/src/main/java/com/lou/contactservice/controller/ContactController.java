package com.lou.contactservice.controller;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.api.PageResult;
import com.lou.common.api.Result;
import com.lou.common.security.RequestContext;
import com.lou.contactservice.config.UserContext;
import com.lou.contactservice.data.AddFriend.AddFriendRequest;
import com.lou.contactservice.data.FriendList.FriendListItem;
import com.lou.contactservice.data.AddFriend.AddFriendResponse;
import com.lou.contactservice.data.ApplyList.ApplyListRequest;
import com.lou.contactservice.data.ApplyList.ApplyListResponse;
import com.lou.contactservice.data.BlockFriend.BlockFriendRequest;
import com.lou.contactservice.data.BlockFriend.BlockFriendResponse;
import com.lou.contactservice.data.CreateGroup.CreateGroupRequest;
import com.lou.contactservice.data.CreateGroup.CreateGroupResponse;
import com.lou.contactservice.data.DeleteFriend.DeleteFriendRequest;
import com.lou.contactservice.data.DeleteFriend.DeleteFriendResponse;
import com.lou.contactservice.data.ExitGroup.ExitGroupRequest;
import com.lou.contactservice.data.ExitGroup.ExitGroupResponse;
import com.lou.contactservice.data.FriendDetail.FriendDetailRequest;
import com.lou.contactservice.data.FriendDetail.FriendDetailResponse;
import com.lou.contactservice.data.GetGroupMembers.GroupMembersRequest;
import com.lou.contactservice.data.GetGroupMembers.GroupMembersResponse;
import com.lou.contactservice.data.KickGroup.KickGroupMembersRequest;
import com.lou.contactservice.data.KickGroup.KickGroupMembersResponse;
import com.lou.contactservice.data.ModifyApply.ModifyApplyRequest;
import com.lou.contactservice.data.ModifyApply.ModifyApplyResponse;
import com.lou.contactservice.data.SearchUser.SearchUserRequest;
import com.lou.contactservice.data.SearchUser.SearchUserResponse;
import com.lou.contactservice.data.SetAdmin.SetGroupAdminRequest;
import com.lou.contactservice.data.SetAdmin.SetGroupAdminResponse;
import com.lou.contactservice.data.UnreadApply.UnreadApplyRequest;
import com.lou.contactservice.data.UnreadApply.UnreadApplyResponse;
import com.lou.contactservice.data.inviteGroup.InviteGroupRequest;
import com.lou.contactservice.data.inviteGroup.InviteGroupResponse;
import com.lou.contactservice.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.security.PublicKey;

@RestController
@RequestMapping("/api/v1/contact")
public class ContactController {

    @Autowired
    private FriendService friendService;

    @Autowired
    private ApplyFriendService applyFriendService;

    @Autowired
    private SessionService sessionService;

    @Autowired
    private GroupService groupService;

    @Autowired
    private KickGroupService kickGroupService;

    @Autowired
    private ExitGroupService exitGroupService;

    @Autowired
    private GetGroupMembersService getGroupMembersService;

    @Autowired
    private GroupAdminService groupAdminService;

    /**
     * 校验请求中代表"操作人本人"的ID与网关注入的可信用户ID一致；不一致即越权,
     * 抛 ApiException(FORBIDDEN) -> 403。当 UserContext 为空（内部调用）时跳过校验。
     */
    private void requireOperator(Long operatorId) {
        Long current = UserContext.get();
        if (current != null && operatorId != null && !current.equals(operatorId)) {
            throw new ApiException(CommonError.FORBIDDEN, "无权限操作");
        }
    }

//    @GetMapping("/user")
//    public Result<UserResponse> getUser() {
//        UserResponse response = new UserResponse();
//        response.setAvatar("www.baidu.com");
//
//        return Result.ok(response);
//    }

    /** 好友列表上限/默认页大小(03-contracts.md §4)。 */
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;
    private static final int DEFAULT_FRIEND_STATUS = 1;

    /**
     * 好友列表(新客户端 API,chat-common 包络 + 游标分页)。
     * 操作人一律取 RequestContext.requireUserId(),不信任入参 userId。
     *
     * GET /api/v1/contact/friends?cursor=&limit=&status=
     */
    @GetMapping("/friends")
    public Result<PageResult<FriendListItem>> listFriends(
            @RequestParam(value = "cursor", required = false) String cursor,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestParam(value = "status", required = false) Integer status) {
        Long actorId = Long.valueOf(RequestContext.requireUserId());

        int safeLimit = (limit == null || limit <= 0) ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        int safeStatus = (status == null) ? DEFAULT_FRIEND_STATUS : status;

        PageResult<FriendListItem> page = friendService.listFriends(actorId, safeStatus, cursor, safeLimit);
        return Result.ok(page);
    }

    @GetMapping("/{userUUid}/user")
    public Result<SearchUserResponse> searchUser(@Valid @ModelAttribute SearchUserRequest request) {
        requireOperator(Long.valueOf(request.getUserUuid()));
        SearchUserResponse response = friendService.getUserDetails(request);

        return Result.ok(response);
    }

    @PostMapping("/{userUuid}/friend/{receiveUserUuid}")
    public Result<?> addFriend(@NotNull(message = "发起人不能为空") @PathVariable("userUuid") String userUuid,
                               @NotNull(message = "接收者不能为空") @PathVariable("receiveUserUuid") String receiveUserUuid,
                               @RequestBody AddFriendRequest request) throws Exception {
        requireOperator(Long.valueOf(userUuid));
        applyFriendService.addFriend(userUuid, receiveUserUuid, request);
        return Result.ok(1);
    }

    /**
     * 获取用户信息详情
     */
    @GetMapping("/{userUuid}/friend/{friendUuid}")
    public Result<FriendDetailResponse> getFriendDetail(@Valid @ModelAttribute FriendDetailRequest request) {
        requireOperator(request.getUserUuid());
        FriendDetailResponse response = friendService.getFriendDetails(request);

        return Result.ok(response);
    }

    @GetMapping("/{userUuid}/applyCount")
    public Result<UnreadApplyResponse> getUnreadApplyCount(@Valid @ModelAttribute UnreadApplyRequest request) {
        requireOperator(request.getUserUuid());
        UnreadApplyResponse response = applyFriendService.getUnreadApply(request);

        return Result.ok(response);
    }


    @GetMapping("/{userUuid}/apply")
    public Result<ApplyListResponse> getApplyList(@Valid @ModelAttribute ApplyListRequest request) {
        requireOperator(request.getUserUuid());
        ApplyListResponse response = applyFriendService.getApplyList(request);
        return Result.ok(response);
    }

    @PostMapping("{userUuid}/application/{status}")
    public Result<ModifyApplyResponse> modifyFriendApplicationStatus(@Valid @ModelAttribute ModifyApplyRequest request) throws Exception {
        requireOperator(request.getUserUuid());
        ModifyApplyResponse response = applyFriendService.modifyApply(request);

        return Result.ok(response);
    }


    @DeleteMapping("/{userUuid}/friend/{receiveUserUuid}")
    public Result<DeleteFriendResponse> deleteFriend(@Valid @ModelAttribute DeleteFriendRequest request) {
        requireOperator(request.getUserUuid());
        DeleteFriendResponse response = friendService.deleteFriend(request);

        return Result.ok(response);
    }

    @PostMapping("/{userUuid}/block/{receiveUserUuid}")
    public Result<BlockFriendResponse> blockFriend(@Valid @ModelAttribute BlockFriendRequest request) throws Exception {
        requireOperator(Long.valueOf(request.getUserUuid()));
        BlockFriendResponse response = friendService.blockFriend(request);

        return Result.ok(response);
    }


    // Group
    @PostMapping("/groups")
    public Result<CreateGroupResponse> createGroup(@Valid @RequestBody CreateGroupRequest request) {
        requireOperator(request.getCreatorId());
        CreateGroupResponse response = sessionService.createGroup(request);

        return Result.ok(response);
    }

    @PostMapping("/group/invite")
    public Result<InviteGroupResponse> inviteGroup(@Valid @RequestBody InviteGroupRequest request) throws Exception {
        requireOperator(request.getInviterId());
        InviteGroupResponse response = groupService.inviteGroup(request);

        return Result.ok(response);
    }

    @PostMapping("/group/kick")
    public Result<KickGroupMembersResponse> kickGroupMembers(@Valid @RequestBody KickGroupMembersRequest request) {
        requireOperator(request.getOperatorId());
        KickGroupMembersResponse response = kickGroupService.kickGroupMembers(request);

        return Result.ok(response);
    }

    @PostMapping("/group/exit")
    public Result<ExitGroupResponse> exitGroup(@RequestBody ExitGroupRequest request) {
        requireOperator(request.getUserId());
        ExitGroupResponse response = exitGroupService.exitGroup(request);

        return Result.ok(response);
    }

    @GetMapping("/group/{sessionId}/members")
    public Result<GroupMembersResponse> getGroupMembers(@Valid GroupMembersRequest request) {
        GroupMembersResponse response = getGroupMembersService.getGroupMembers(request);

        return Result.ok(response);
    }

    @PostMapping("/group/setAdmin")
    public Result<SetGroupAdminResponse> setGroupAdmin(@Valid @RequestBody SetGroupAdminRequest request) {
        requireOperator(request.getUserId());
        SetGroupAdminResponse response = groupAdminService.setGroupAdmin(request);
        return Result.ok(response);
    }


}
