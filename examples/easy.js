// Don't forget to load dom. Otherwise, makeWordCloud function might fails to work.
$().ready(function(){

    // Make sure the format => [ {"word": String, "value": Number}, ..., ... ]
    // Value should be greater than 0
    data = [
        {"word": "田中", "value": 3}, 
        {"word": "太郎", "value": 13}, 
        {"word": "西尾", "value": 8},
        {"word": "維新", "value": 80},
        {"word": "完全", "value": 18},
        {"word": "無血", "value": 2},
        {"word": "開城", "value": 6},
        {"word": "極悪", "value": 2},
        {"word": "戦隊", "value": 1},
        {"word": "田中", "value": 3}, 
        {"word": "太郎", "value": 13}, 
        {"word": "西尾", "value": 8},
        {"word": "維新", "value": 80},
        {"word": "完全", "value": 18},
        {"word": "無血", "value": 2},
        {"word": "開城", "value": 6},
        {"word": "極悪", "value": 2},
        {"word": "戦隊", "value": 1},
        {"word": "田中", "value": 3}, 
        {"word": "太郎", "value": 13}, 
        {"word": "西尾", "value": 8},
        {"word": "維新", "value": 80},
        {"word": "完全", "value": 18},
        {"word": "無血", "value": 2},
        {"word": "開城", "value": 6},
        {"word": "極悪", "value": 2},
        {"word": "戦隊", "value": 1},
    ]
    
    // you can use own color converting function if you want
    var my_color = d3.scale.category20();

    // makeWordCloud(data, css selector that you wanna insert in, scale of svg, class name of svg, font-family, rotate or not, your color converting function)
    window.makeWordCloud(data, "body", 500, "my_svg", "Impact", true, my_color)

    // [ svg class, font-family, rotate words or not, color function ] are optional.
    // the simplest way => window.makeWordCloud(data, "body", 500)

})
