package com.lou.momentservice.data.getMomentList;

import com.lou.momentservice.data.createComment.CreateCommentVO;
import com.lou.momentservice.model.vo.MomentVO;
import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

@Data
@Accessors(chain = true)
public class GetMomentListResponse {
    private List<Long> deleteLike;

    private List<Long> deleteComment;

    private List<Long> deleteMoment;

    private List<MomentLikeVO> createLike;

    private List<MomentCommentVO> createComment;

    private List<MomentsVO> createMoment;
}
