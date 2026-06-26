package com.lou.momentservice.controller;

import com.lou.momentservice.common.Result;
import com.lou.momentservice.data.deleteLike.DeleteLikeRequest;
import com.lou.momentservice.data.deleteLike.DeleteLikeResponse;
import com.lou.momentservice.data.createComment.CreateCommentRequest;
import com.lou.momentservice.data.createComment.CreateCommentResponse;
import com.lou.momentservice.data.createComment.MomentCommentDTO;
import com.lou.momentservice.data.createLike.CreateLikeRequest;
import com.lou.momentservice.data.createLike.CreateLikeResponse;
import com.lou.momentservice.data.createMoment.CreateMomentRequest;
import com.lou.momentservice.data.createMoment.CreateMomentResponse;
import com.lou.momentservice.data.deleteComment.DeleteCommentRequest;
import com.lou.momentservice.data.deleteComment.DeleteCommentResponse;
import com.lou.momentservice.data.deleteMoment.DeleteMomentRequest;
import com.lou.momentservice.data.deleteMoment.DeleteMomentResponse;
import com.lou.momentservice.config.UserContext;
import com.lou.momentservice.data.getMomentList.GetMomentListRequest;
import com.lou.momentservice.data.getMomentList.GetMomentListResponse;
import com.lou.momentservice.service.MomentCommentService;
import com.lou.momentservice.service.MomentLikeService;
import com.lou.momentservice.service.MomentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;

/**
 * @ClassName MomentController
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/21 19:54
 */

@Slf4j
@RestController
@RequestMapping("/api/v1/moment")
@RequiredArgsConstructor
public class MomentController {
    @Autowired
    private MomentService momentService;

    @Autowired
    private MomentLikeService momentLikeService;

    @Autowired
    private MomentCommentService momentCommentService;

    @PostMapping("")
    public Result<CreateMomentResponse> createMoment(@Valid @RequestBody CreateMomentRequest request) throws Exception {
        // createMoment.userId 为 String，需解析后与可信用户ID比较
        verifyOperator(request.getUserId());

        CreateMomentResponse response = momentService.createMoment(request);

        return Result.OK(response);
    }

    @DeleteMapping("{momentId}")
    public Result<DeleteMomentResponse> deleteMoment(@Valid @ModelAttribute DeleteMomentRequest request) {
        verifyOperator(request.getUserId());

        DeleteMomentResponse response = momentService.deleteMoment(request);

        return Result.OK(response);
    }

    @PostMapping("/like/{momentId}")
    public Result<CreateLikeResponse> likeMoment(@PathVariable Long momentId, @Valid @RequestBody CreateLikeRequest request) throws Exception {
        verifyOperator(request.getUserId());

        CreateLikeResponse response = momentLikeService.likeMoment(momentId, request);

        return Result.OK(response);
    }

    @DeleteMapping("/like/{momentId}")
    public Result<DeleteLikeResponse> deleteLikeMoment(@Valid @ModelAttribute DeleteLikeRequest request) {
        verifyOperator(request.getUserId());

        DeleteLikeResponse response = momentLikeService.deleteLikeMoment(request);

        return Result.OK(response);
    }

    @PostMapping("/comment/{momentId}")
    public Result<CreateCommentResponse> createComment(@NotNull(message = "朋友圈 ID 不能为空")
                                                       @PathVariable("momentId") Long momentId,
                                                       @Valid @RequestBody MomentCommentDTO momentCommentDTO) throws Exception {
        verifyOperator(momentCommentDTO.getUserId());

        CreateCommentRequest createCommentRequest = new CreateCommentRequest()
                .setMomentId(momentId)
                .setMomentCommentDTO(momentCommentDTO);

        CreateCommentResponse response = momentCommentService.createComment(createCommentRequest);
        return Result.OK(response);
    }

    @DeleteMapping("/comment/{momentId}")
    public Result<DeleteCommentResponse> deleteComment(@Valid @ModelAttribute DeleteCommentRequest request) {
        verifyOperator(request.getUserId());

        DeleteCommentResponse response = momentCommentService.deleteComment(request);
        return Result.OK(response);
    }

    @GetMapping("/list/{userId}")
    public Result<GetMomentListResponse> getMomentList(@Valid @ModelAttribute GetMomentListRequest request) {
        GetMomentListResponse response = momentService.getMomentList(request);

        return Result.OK(response);
    }

    /**
     * 校验请求体中"操作人本人"的 userId 与网关注入的可信用户ID一致。
     * 当 UserContext.get() 为空(内部调用或无上下文)时跳过校验。
     * 不一致返回 403。
     *
     * @param operatorUserId 请求里表示当前操作人的用户ID (Long)
     */
    private void verifyOperator(Long operatorUserId) {
        Long trusted = UserContext.get();
        if (trusted == null) {
            return;
        }
        if (operatorUserId == null || !trusted.equals(operatorUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权代表他人操作");
        }
    }

    /**
     * String 形式的操作人 userId 重载，解析为 Long 后比较。
     * 解析失败视为不匹配，返回 403。
     *
     * @param operatorUserId 请求里表示当前操作人的用户ID (String)
     */
    private void verifyOperator(String operatorUserId) {
        Long trusted = UserContext.get();
        if (trusted == null) {
            return;
        }
        if (operatorUserId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权代表他人操作");
        }
        try {
            if (!trusted.equals(Long.valueOf(operatorUserId.trim()))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权代表他人操作");
            }
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权代表他人操作");
        }
    }


}
