package com.lou.infinitechatagent.memory.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemoryContext {
    private Boolean summaryInjected;
    private String sessionSummary;
    private Boolean longTermMemoryInjected;
    private List<MemoryItem> longTermMemories;
    private Integer usedMemoryCount;
    private Integer estimatedMemoryTokens;
}
