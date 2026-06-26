package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

/**
 * @ClassName HeartBody
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 15:41
 */

@Data
@Accessors(chain = true)
public class HeartBody implements Serializable {
    private Integer type;
    private String message;
}
