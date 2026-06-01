//učitavanje iz API-ja
const API_URL = "https://api.nobelprize.org/2.1/laureates?limit=1100&offset=0";

let cleanedData = [];

//čišćenje podataka
d3.json(API_URL, function(error, data) {

    if (error || !data || !data.laureates) {
        console.log("API error");
        return;
    }

    const laureates = data.laureates;

    cleanedData = laureates.map(d => ({
        name: d.fullName?.en || d.knownName?.en || "Unknown",
        year: d.nobelPrizes?.[0]?.awardYear || "Unknown",
        country: d.birth?.place?.country?.en || "Unknown",
        category: d.nobelPrizes?.[0]?.category?.en || "Unknown",
        gender: d.gender || "unknown"
    }));

    updateStats(cleanedData);
    drawCountryChart(cleanedData);
    drawCategoryDonut(cleanedData);
});

//dinamičko ažuriranje osnovnih statističkih kartica
function updateStats(data) {

    const stats = document.querySelectorAll(".stat-value");
    if (stats.length < 4) return;

    const totalLaureates = data.length;

    const countries = new Set(
        data.map(d => d.country).filter(d => d !== "Unknown")
    );

    const topCountry = getTop(data, "country");
    const topCategory = getTop(data, "category");

    stats[0].textContent = totalLaureates;
    stats[1].textContent = countries.size;
    stats[2].textContent = topCountry;
    stats[3].textContent = topCategory;
}

//pomoćna funkcija
function getTop(data, field) {

    const counts = d3.nest()
        .key(d => d[field])
        .rollup(v => v.length)
        .entries(data)
        .sort((a, b) => b.values - a.values);

    return counts[0]?.key || "N/A";
}

//bar chart koji prikazuje top 10 država po broju dobitnika
function drawCountryChart(data) {

    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };

    const svg = d3.select("#countryChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const countryCounts = d3.nest()
        .key(d => d.country)
        .rollup(v => v.length)
        .entries(data)
        .sort((a, b) => b.values - a.values)
        .slice(0, 10);

    const x = d3.scale.ordinal()
        .domain(countryCounts.map(d => d.key))
        .rangeRoundBands([0, chartWidth], 0.1);

    const y = d3.scale.linear()
        .domain([0, d3.max(countryCounts, d => d.values)])
        .range([chartHeight, 0]);

    g.selectAll(".bar")
        .data(countryCounts)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.values))
        .attr("width", x.rangeBand())
        .attr("height", d => chartHeight - y(d.values))
        .attr("fill", "#D4AF37");

    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.svg.axis().scale(x).orient("bottom"))
        .selectAll("text")
        .style("fill", "#D4AF37")
        .style("font-size", "10px")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    g.append("g")
        .call(d3.svg.axis().scale(y).orient("left"))
        .selectAll("text")
        .style("fill", "#D4AF37");

    g.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("fill", "#D4AF37")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Top 10 država po broju dobitnika");
}

//donut chart koji prikazuje distribuciju kategorija
function drawCategoryDonut(data) {

    const width = 400;
    const height = 400;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select("#categoryChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    const centerGroup = svg.append("g");

    const categoryCounts = d3.nest()
        .key(function(d) { return d.category; })
        .rollup(function(v) { return v.length; })
        .entries(data);

    const color = d3.scale.ordinal()
    .range([
        "#F2D675", 
        "#E8C766",
        "#DDBA55",
        "#D4AF37", 
        "#C89E2D",
        "#B88924",
        "#A6781C",
        "#8F6316"
    ]);

    const pie = d3.layout.pie()
        .value(function(d) { return d.values; });

    const arc = d3.svg.arc()
        .innerRadius(radius - 100)
        .outerRadius(radius - 20);

    const arcs = svg.selectAll("arc")
        .data(pie(categoryCounts))
        .enter()
        .append("g");
    
    centerGroup.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "-5")
    .style("fill", "#D4AF37")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Kategorije");

    arcs.append("path")
        .attr("d", arc)
        .style("fill", function(d) {
            return color(d.data.key);
        })
        .style("stroke", "#0B1F3A")
        .style("stroke-width", "2px");

    arcs.append("text")
        .attr("transform", function(d) {
            return "translate(" + arc.centroid(d) + ")";
        })
        .attr("text-anchor", "middle")
        .style("fill", "#071426")
        .style("font-weight", "bold")
        .style("font-size", "10px")
        .text(function(d) {
            return d.data.key.length > 8
                ? d.data.key.substring(0, 8) + "..."
                : d.data.key;
        });
}