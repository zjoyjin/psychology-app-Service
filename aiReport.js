Page({
  data: {
    isLoading: false,
    aiResponse: '',
    dimensionScores: [],
    totalScore: 0,
    chartHeight: 400
  },

  onLoad(options) {
    // Get survey results from global data or storage
    const surveyResults = getApp().globalData.surveyResults || 
                        wx.getStorageSync('surveyResults');
    
    if (surveyResults && surveyResults.assessment) {
      this.calculateScores(surveyResults.assessment);
      this.sendToKimiAPI(surveyResults.assessment);
    } else {
      wx.showToast({
        title: '未找到测试数据',
        icon: 'none'
      });
      wx.navigateBack();
    }

    // Draw chart after data is ready
    setTimeout(() => {
      this.drawRadarChart();
    }, 300);
  },

  calculateScores(assessment) {
    const dimensions = [
      { name: '延迟满足', questions: [1, 5, 10, 12] },
      { name: '情绪调节', questions: [8, 15] },
      { name: '专注力', questions: [3, 7, 11] }, 
      { name: '规则遵守', questions: [9, 13] },
      { name: '挫折应对', questions: [6, 14] }
    ];

    const dimensionScores = dimensions.map(dim => {
      const scores = dim.questions.map(qNum => {
        const answer = assessment[`q${qNum}`];
        return answer ? parseInt(answer) : 3;
      });
      
      const sum = scores.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / scores.length) * 20);
      
      return {
        name: dim.name,
        score: avg,
        questions: dim.questions
      };
    });

    const totalScore = Math.round(
      dimensionScores.reduce((sum, dim) => sum + dim.score, 0) / dimensionScores.length
    );

    this.setData({
      dimensionScores,
      totalScore
    });
  },

  async sendToKimiAPI(assessment) {
    this.setData({ isLoading: true });
    
    try {
      // Prepare the prompt for OpenAI API
      const dimensions = this.data.dimensionScores.map(d => 
        `${d.name}: ${d.score}%`
      ).join('\n');
      
      const prompt = `请根据以下儿童耐心评估结果生成一份详细的报告：
      
      评估维度及得分：
      ${dimensions}
      
      总分：${this.data.totalScore}%
      
      请用中文提供：
      1. 对每个维度的详细分析（100字左右）
      2. 总体评价（100字左右）
      3. 针对性的改进建议（200字左右）
      4. 适合家长采用的培养方法（100字左右）
      
      请用专业但亲切的语气，适合家长阅读。`;

      // Call your backend API that connects to OpenAI
      const response = await wx.cloud.callFunction({
        name: 'callOpenAIAPI',
        data: {
          prompt: prompt
        }
      });

      // Or if calling directly from frontend (not recommended for production):
      // const response = await this.callOpenAIDirectly(prompt);

      this.setData({
        aiResponse: response.result || response.data,
        isLoading: false
      });
    } catch (error) {
      console.error('OpenAI API error:', error);
      this.setData({
        aiResponse: '生成报告时出错，请稍后再试。',
        isLoading: false
      });
    }
  },

  // new API called here
  async callOpenAIDirectly(prompt) {
    const API_KEY = ''; // Should be stored securely
    const response = await wx.request({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      data: {
        model: "gpt-3.5-turbo", // or "gpt-4" if available
        messages: [
          {
            role: "system",
            content: "你是一位专业的儿童心理学专家，擅长分析儿童行为评估报告并提供建设性建议。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      }
    });
    return response.data.choices[0].message.content;
  }, 


  drawRadarChart() {
    // Same implementation as your original report page
    const ctx = wx.createCanvasContext('radarCanvas', this);
    const { windowWidth } = wx.getSystemInfoSync();
    const width = windowWidth * 0.9;
    const height = this.data.chartHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.7;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.setLineWidth(1);
    ctx.setStrokeStyle('#FFD700');
    for (let i = 0; i < 5; i++) {
      const r = radius * (i + 1) / 5;
      ctx.beginPath();
      for (let j = 0; j <= this.data.dimensionScores.length; j++) {
        const angle = (j * 2 * Math.PI) / this.data.dimensionScores.length - Math.PI/2;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.setLineWidth(1.5);
    this.data.dimensionScores.forEach((_, i) => {
      const angle = (i * 2 * Math.PI) / this.data.dimensionScores.length - Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
      ctx.stroke();
      
      ctx.setFontSize(14);
      ctx.setFillStyle('#333');
      const textX = centerX + (radius + 15) * Math.cos(angle);
      const textY = centerY + (radius + 15) * Math.sin(angle);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(this.data.dimensionScores[i].name, textX, textY);
    });

    ctx.setFillStyle('rgba(255, 107, 129, 0.2)');
    ctx.setStrokeStyle('#FF6B81');
    ctx.setLineWidth(2);
    ctx.beginPath();
    
    this.data.dimensionScores.forEach((dim, i) => {
      const r = (dim.score / 100) * radius;
      const angle = (i * 2 * Math.PI) / this.data.dimensionScores.length - Math.PI/2;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.draw();
  },

  copyReport() {
    wx.setClipboardData({
      data: this.data.aiResponse,
      success: () => {
        wx.showToast({
          title: '报告已复制',
          icon: 'success'
        });
      }
    });
  },

  navigateToHome() {
    wx.switchTab({
      url: '/pages/home/home'
    });
  }
});