//učitavanje iz API-ja
const API_URL = "https://api.nobelprize.org/2.1/laureates?limit=1100&offset=0";

const tooltip = d3.select("#tooltip");

const themeToggle = document.getElementById("themeToggle");

let cleanedData = [];

let selectedYear = null;
let focusTimeout = null;
let timelineSvg;
let timelineG;
let xScale;
let yScale;
let timelineLine;
let timelinePath;
let timelineCircles;
let yearCounts;

const ZOOM_RANGE = 10; 
let baseXDomain = null;

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
    drawTimeline(cleanedData);
    styleXAxisAfterZoom();
    drawCountryChart(cleanedData);
    drawCategoryDonut(cleanedData);
});

themeToggle.addEventListener("click", () => {

    document.body.classList.toggle("light-mode");

    if (document.body.classList.contains("light-mode")) {
        themeToggle.textContent = "Dark Mode";
    } else {
        themeToggle.textContent = "Light Mode";
    }

    d3.select("#timelineChart").html("");
    d3.select("#countryChart").html("");
    d3.select("#categoryChart").html("");

    drawTimeline(cleanedData);
    styleXAxisAfterZoom();
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

//pomoćna fnkcija za mijenjanje teme 
function getTheme() {
    const styles = getComputedStyle(document.body);

    return {
        accent: styles.getPropertyValue("--accent").trim(),
        accentLight: styles.getPropertyValue("--accent-light").trim(),
        donutText: styles.getPropertyValue("--donut-text").trim()
    };
}

function getLaureatesByYear(year) {
    return cleanedData.filter(d => +d.year === year);
}

//timeline chart
function drawTimeline(data) {

    const width = 1800;
    const height = 500;
    const margin = { top: 20, right: 20, bottom: 70, left: 50 };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const theme = getTheme();

    timelineSvg = d3.select("#timelineChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    timelineG = timelineSvg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    yearCounts = d3.nest()
        .key(d => d.year)
        .rollup(v => v.length)
        .entries(data)
        .filter(d => d.key !== "Unknown")
        .sort((a, b) => +a.key - +b.key);

    xScale = d3.scale.linear()
        .domain(d3.extent(yearCounts, d => +d.key))
        .range([0, chartWidth]);

    baseXDomain = xScale.domain();

    yScale = d3.scale.linear()
        .domain([0, d3.max(yearCounts, d => d.values)])
        .range([chartHeight, 0]);

    timelineLine = d3.svg.line()
        .x(d => xScale(+d.key))
        .y(d => yScale(d.values));

    timelinePath = timelineG.append("path")
        .datum(yearCounts)
        .attr("fill", "none")
        .attr("stroke", theme.accent)
        .attr("stroke-width", 4)
        .attr("d", timelineLine);

    timelineCircles = timelineG.selectAll("circle")
        .data(yearCounts)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(+d.key))
        .attr("cy", d => yScale(d.values))
        .attr("r", 5)
        .attr("fill", theme.accentLight)
        .on("mouseover", function (d) {
            d3.select(this)
                .transition()
                .duration(150)
                .attr("r", 8);
            tooltip
                .style("opacity", 1)
                .html(
                    `<strong>Year:</strong> ${d.key}<br/>
                    <strong>Winners:</strong> ${d.values}`
                );
        })
        .on("mousemove", function () {
            tooltip
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 30) + "px");
        })
        .on("click", function(d) {
            selectedYear = +d.key;
            renderYearDetails(selectedYear);
            document.getElementById("detailView").style.display = "block";
            zoomToYear(selectedYear);
            clearTimeout(focusTimeout);
            focusTimeout = setTimeout(() => {
                resetZoom();
            }, 10000);
        })
        .on("mouseout", function () {
            d3.select(this)
                .transition()
                .duration(150)
                .attr("r", 5);
            tooltip
                .style("opacity", 0);
        });

    timelineG.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.svg.axis().scale(xScale).orient("bottom"))
        .selectAll("text")
        .style("fill", theme.accent)
        .style("font-size", "18px");

    timelineG.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight + 60)
        .attr("text-anchor", "middle")
        .style("fill", theme.accent)
        .style("font-size", "18px")
        .text("Godine");

    timelineG.append("g")
        .call(d3.svg.axis().scale(yScale).orient("left"))
        .selectAll("text")
        .style("fill", theme.accent)
        .style("font-size", "18px");

    timelineG.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", -35)
        .attr("text-anchor", "middle")
        .style("fill", theme.accent)
        .style("font-size", "18px")
        .text("Broj dobitnika");

    timelineG.selectAll(".x.axis, .y.axis")
    .style("stroke", theme.accent)
    .style("fill", theme.accent);

    timelineG.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("fill", theme.accent)
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("BROJ DOBITNIKA PO GODINAMA");
}

function renderYearDetails(year) {
    const data = getLaureatesByYear(year);

    document.getElementById("detailTitle").textContent =
        `Dobitnici u ${year}`;

    document.getElementById("detailList").innerHTML =
        data.map(d => `
            <div style="padding:10px; border-bottom:1px solid var(--accent);">
                <strong>${d.name}</strong><br/>
                Kategorija: ${d.category}<br/>
                Država: ${d.country}
            </div>
        `).join("");
}

//helper funkcija za ponovno stajlanje x osi
function styleXAxisAfterZoom() {
    timelineG.selectAll(".x-axis text")
        .style("fill", getTheme().accent)
        .style("font-size", "18px");
}

//funkcija za zumiranje
function zoomToYear(year) {
    const min = Math.max(baseXDomain[0], year - ZOOM_RANGE);
    const max = Math.min(baseXDomain[1], year + ZOOM_RANGE);
    xScale.domain([min, max]);
    const t = timelineSvg.transition().duration(900).ease("cubic-in-out");
    timelinePath
        .transition(t)
        .attr("d", timelineLine);

    timelineCircles
        .transition(t)
        .attr("cx", d => xScale(+d.key))
        .attr("cy", d => yScale(d.values));

    timelineG.select(".x-axis")
        .transition(t)
        .call(d3.svg.axis().scale(xScale).orient("bottom"))
        .each("end", styleXAxisAfterZoom); 
}

//funkcija za resetiranje zooma timeline grafa
function resetZoom() {
    xScale.domain(baseXDomain);
    const t = timelineSvg.transition().duration(750);
    timelinePath
        .transition(t)
        .attr("d", timelineLine);

    timelineCircles
        .transition(t)
        .attr("cx", d => xScale(+d.key))
        .attr("cy", d => yScale(d.values));

    timelineG.select(".x-axis")
        .transition(t)
        .call(d3.svg.axis().scale(xScale).orient("bottom"))
        .each("end", styleXAxisAfterZoom);

    selectedYear = null;
    document.getElementById("detailView").style.display = "none";
    document.getElementById("detailList").innerHTML = "";
}

//bar chart koji prikazuje top 10 država po broju dobitnika
function drawCountryChart(data) {

    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 140, left: 60 };

    const theme = getTheme();

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
        .rangeRoundBands([0, chartWidth], 0.2);

    const y = d3.scale.linear()
        .domain([0, d3.max(countryCounts, d => d.values)])
        .range([chartHeight, 0]);

    g.selectAll(".bar")
        .data(countryCounts)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.values))
        .attr("width", x.rangeBand())
        .attr("height", d => chartHeight - y(d.values))
        .attr("fill", theme.accent)
        .on("mouseover", function(d) {
            const bar = d3.select(this);
            const originalY = +bar.attr("y");
            const originalHeight = +bar.attr("height");
            bar.transition()
                .duration(150)
                .attr("fill", theme.accentLight)
                .attr("width", x.rangeBand() + 8)
                .attr("x", x(d.key) - 4)
                .attr("y", originalY - 8)
                .attr("height", originalHeight + 8);
            tooltip
                .style("opacity", 1)
                .html(
                    "<strong>" + d.key +
                    "</strong><br/>Dobitnika: " + d.values
                );
        })
        .on("mousemove", function() {
            tooltip
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 30) + "px");
        })
        .on("mouseout", function() {

            d3.select(this)
                .transition()
                .duration(150)
                .attr("fill", theme.accent)
                .attr("width", x.rangeBand())
                .attr("x", d => x(d.key))
                .attr("y", d => y(d.values))
                .attr("height", d => chartHeight - y(d.values));
            tooltip.style("opacity", 0);
        })

    g.append("g")
        .attr("transform", `translate(0,${chartHeight})`)
        .call(d3.svg.axis().scale(x).orient("bottom"))
        .selectAll("text")
        .style("fill", theme.accent)
        .style("font-size", "18px")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    g.append("text")
        .attr("x", chartWidth - 8)
        .attr("y", chartHeight + 40)
        .attr("text-anchor", "middle")
        .style("fill", theme.accent)
        .style("font-size", "18px")
        .text("Države");

    g.append("g")
        .call(d3.svg.axis().scale(y).orient("left"))
        .selectAll("text")
        .style("fill", theme.accent)

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -chartHeight / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .style("fill", theme.accent)
        .style("font-size", "18px")
        .text("Broj dobitnika");

    g.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("fill", theme.accent)
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("TOP 10 DRŽAVA PO BROJU DOBITNIKA");
}

//donut chart koji prikazuje distribuciju kategorija
function drawCategoryDonut(data) {

    const width = 400;
    const height = 400;
    const radius = Math.min(width, height) / 2;

    const theme = getTheme();

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
        .entries(data)
        .sort((a, b) => b.values - a.values);

    const max = d3.max(categoryCounts, d => d.values);
    const min = d3.min(categoryCounts, d => d.values);

    const color = d3.scale.linear()
        .domain([min, max])   
        .range([theme.accentLight, theme.accent]);

    const pie = d3.layout.pie()
        .value(function(d) { return d.values; });

    const arc = d3.svg.arc()
        .innerRadius(radius - 75)
        .outerRadius(radius - 20);

    const arcHover = d3.svg.arc()
        .innerRadius(radius - 80)
        .outerRadius(radius - 10);

    const arcs = svg.selectAll("arc")
        .data(pie(categoryCounts))
        .enter()
        .append("g");
    
    centerGroup.append("text")
        .attr("text-anchor", "middle")
        .style("fill", theme.accent)
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text("KATEGORIJE");

    arcs.append("path")
        .attr("d", arc)
        .style("fill", function(d) {
            return color(d.data.values);
        })
        .style("stroke", theme.bgMain || "transparent")
        .style("stroke-width", "2px")
        .on("mouseover", function(d) {
            const originalColor = d3.select(this).style("fill");
            d3.select(this)
                .transition()
                .duration(180)
                .attr("d", arcHover)
                .style("fill", d3.rgb(originalColor).brighter(1.2));
            tooltip
                .style("opacity", 1)
                .html(
                    "<strong>" + d.data.key +
                    "</strong><br/>Dobitnika: " + d.data.values
                );
        })
        .on("mousemove", function() {
            tooltip
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 30) + "px");
        })
        .on("mouseout", function(d) {
            d3.select(this)
                .transition()
                .duration(180)
                .attr("d", arc)
                .style("fill", color(d.data.values));
            tooltip.style("opacity", 0);
        });

    arcs.append("text")
        .attr("transform", function(d) {
            return "translate(" + arc.centroid(d) + ")";
        })
        .attr("text-anchor", "middle")
        .style("fill", theme.donutText)
        .style("font-weight", "bold")
        .style("font-size", "12px")
        .text(function(d) {
            return d.data.key.length > 10
                ? d.data.key.substring(0, 8) + "..."
                : d.data.key;
        });
}
