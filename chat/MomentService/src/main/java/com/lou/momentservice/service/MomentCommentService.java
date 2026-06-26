package com.lou.momentservice.service;

import com.lou.momentservice.data.createComment.CreateCommentRequest;
import com.lou.momentservice.data.createComment.CreateCommentResponse;
import com.lou.momentservice.data.deleteComment.DeleteCommentRequest;
import com.lou.momentservice.data.deleteComment.DeleteCommentResponse;
import com.lou.momentservice.model.MomentComment;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * @author loujun
 * @description 针对表【moment_comment(朋友圈评论)】的数据库操作Service
 * @createDate 2025-06-22 16:55:02
 */
public interface MomentCommentService extends IService<MomentComment> {

    CreateCommentResponse createComment(CreateCommentRequest request) throws Exception;

    DeleteCommentResponse deleteComment(DeleteCommentRequest request);

}
