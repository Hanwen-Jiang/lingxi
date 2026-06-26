package com.lou.momentservice.model.vo;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * @ClassName MomentVO
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/21 20:14
 */

@Data
@Accessors(chain = true)
public class MomentVO {

    private Long momentId;

    private Long userId;

    private String text;

    private List<String> mediaUrls;
}
