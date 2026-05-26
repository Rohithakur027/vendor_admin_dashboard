"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Navigation, Circle, Search, AlertCircle, ChevronRight, ChevronLeft, X, Clock, ArrowLeft, Calendar, ArrowRight } from "lucide-react";
import { superadminApi, type LiveDriver, type LiveLocationEvent, type LocationHistoryPoint } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { DriverStatusEvent } from "@/lib/useDriverStatusFeed";
import { CustomDatePicker, CustomTimePicker, format12h } from "@/components/HistoryPickers";

const ACCENT = "#2563EB";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const BANGALORE_CENTER: [number, number] = [77.5946, 12.9716];
const REFETCH_MS = 60 * 1000;
const DRIVER_MARKER_SRC = "/car.png";

/* ── Map marker with car bitmap ─────────────────────────────────────── */
const DRIVER_MARKER_PNG = {
  green: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAA2CAYAAAC1ItuGAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEvUlEQVR4nO2Ye0xTZxiHz2ayZP8osLWcXqAYseUiuEuWJTOy/TOZA9dSIHU4J8p0M2TA2OLcgiGLm0tMlm1y24ygBeVS5VLwMhyXOZmTQHCi2eJSxkUmtJCWW0mdPfyW72troAORUtQl55c86cnJe97vOW+/9LRlGD58+PDhw4fP/z4AggB87EYQ86gEQBSArwF844Qcr39YMmIA7zpFSgHUAjABGHKDnNM7a0jtLgCipRQTADjCcRwHD8NxnB3AYQBPe1sulAPXQxZpG7mBjN/zoenYD/3gJXRPDmDo9shdTNPotg6g5lYLElqzkdGZi3bzDYco0A0gxBtujxUX61aaLZa+SZttat+fRxHUnIQ1P6fg2lg3jLctDmxzYaZcH+1G2PltCDibiKzrhSC9zBZLr1arCyRrLMJP+mRvb//x4WEz9rTnU7mgpiR89Mf384hZ7sq5+LAzH9IziZCeTsCeX/NAevb09GvJGh7rNTa2rDKZhrnGv9ogq9NQOVlTEvJ6ahYkZ7SZkWOoonKUsjg0GdpgMg3b6+svrPRY0Ggcfp/c6e5LX0FWq6FyssY38V1P3YLkjDYzCrr0Drm6eIhLVXjvp4N0ikbjUKrHghbLaC5psu6HVATqNVRO1kAEaxckZySCBj2Vk9Q6BF+s2kkFLZbRHI/kACwbH7d2kCZ5nVV455eDVE7WsHkOQfM8gjVUTqKPR0rzAeR2nKSCZA0Aj3siGGW1TtpIE8PATXQN3kRE8w4E/rgZytYspF/LRXqnixykX81B+m+HKGkurhxCWgfhW8Re3AuJXo3Qs1tpP8OtPipI1vDoqQMgeoagsR/Pnd+JgJpEBFQnUKRV8Q4q4yE9paZITqoh0cU5qCCoICaUKynP6JPpzboJRi96goSw6q2QVsRRJOVOyuIgKVVRxCdUEB9XOih5AyIXxZscaDdBXqqBYaDPKxNcNjY2foU0yb1aiR31n8+UK1u4HHsslpJc9xly2nVUkKzh0R4kmZiYLCBNXji9C1Ktcna5E/PIaWfKsUdjwOZvxPO67VRwctKW55Gcc4qZd+7YkXz5S0jL/ysnpnLKhckVxYAtjMHbF/aD9AaQsRhBBelwbrDVseHnkiuZXY7VusSmyTk59/dl15ec1R4LOiXPTGEKmovZkJSp7i1XPI9cIeF1aBqyXHJ1i5JzTdHO2cfH/rFy8S37IEyJgp8iHH4h4RCmrIekKg7iajXE5JVQGQdRpQqiUyqIdEoIktfBl9QrwumxuvFTkF52zj626OlNk4zmwFkLjhRP+bIKyCNeoviyCvhnvkI/gCk1aoiribBDVpj2MtzrDxeVTHHgJgBs8IrcNMm1r8ZqRv0DI1BQpEN+YQWEAWuwMWELeq2D6J0YRI8br8VvgXv9hljNCIBIZiniwyrK/UQhyPzkAD7Y+wXI8VvbU8cBdM1G0rbd4+71Pqy8lFmqrBAHP+vjL7eSt4rgw8onfASr13qr3itZLggL9mHl2YTlguBV3q7nw4cPHz58Hq08QR65DMMIGIZhGYaROGGd51Y4ax5oyC8wf4ZhQhmGibxPQp3XLOavtvvOUwsQi3SDXLvkIVMQejBB4YOa4L32oNjJQ92DfJhp+ReVffSfeWwgqwAAAABJRU5ErkJggg==",
  greenActive: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAA2CAYAAAC1ItuGAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEk0lEQVR4nO2Ye0xbZRiHjy4x8Z+tSM+hQ122UGAwBzGbMzHh0sIoxgUiqFPmJCZesm4Komaiy9iFcb+WTiZjLDBkA3RmNyMbzSSoi5mXLYaYzDKBMC6lUKCXNFlPf+Y751SxTC6nZZvJ+SVP0py8fd+n7/maXihKihQpUqRIkfK/D4DVAHZ7sZq6XwIgFkAlgCoB8jjmXskEA3hbEGkBcBaACcCYF+TaGaGG1L4FYOVSitEA6lmWZSEyLMu6ANQBkPtbLoIF20eG/DjSA+23JUi98CFO917GzalbMDkmZmOfwM3JQXx5w4CUr3Kwq7MEV4d7eFGwfwJY6w+3B5qa2tZMWCwDDqfTvfsHPZhjyQhpfB7XzX9gxD6+IH4bM0JZlwqmJhG5XTUgvSYslv7GxrZVZIYPfo893N8/2Gw2TyD7Yhknx9RrkNVVvmC5EYGszlIwukSOnPOlID37+gYbyQzRegbDdyEmk5m99PsV0DVJnBxzVIOqa6cWJ2gbR9XVFk6Ork4AXaiGoecKTCazq6Oja41owdFR8zvklb5x7iBo3WZOjqC/3r4ouRHbOPQ/t/JyVURQhTfb93NbHB0d2yla0GKZ0pMmGxq2ga4WBOs00F9rW5TciEeQyBEKVNhQ8wonaLFM1YiSA7DMarX/Qprovj+JzDN5nBzzWdL8grbZ6H8SBCsTkNm6B7quZk6QzADwoBjBWLvd4SRNjLf6YRweQOjxNE4w+fS70BqKoTUUQdtZBO0lD4XQXhToKMQOD98UQnNyFyenPJwC41A/15P0JjNEfeoA0MwU7B0ewLr6l8BUJYKpTARTkcBTLlCmBlMqUKIGXaz6hyJCPOjCeETq0tA7NADj4L8ENb5vcGgASl0K6JnDi1TcgSeD/6YgHvJDcTz5cZAfFDgQB/n+OIQUP8f3G/R9g8ump62/kibV3Z9je8snc8sVzC/HsS8W24/novoyfwbJDFFnkMRmc9SSJlFHXgadr1qYXP7ccvK8WMhzYxBd8SIn6HA4D4uSE7aYc/u2Cxln9/BSi5E78B9yhL2x2Nb6MUhvANm+CIaTDud7u/nbWzT7vNHzye2bLSfPi8HXN7o9X3JCRQsKkhfcbjfS2j/wTW6vhxi80Py+R+6cT3KeLbpYl3XKaWNTvsiGPH0TApSRHIHpT4EuU4MuS+ApVfNwbyay8XgEpm5EQEgEX5+6EanNWZh22lgX65r2eXszJDUsWHvt0SZ3gCIcYeuf4QhQhCPwtadBV6pBV6hBlwtw0ioEZmyCd31dwwk3C9YGIMkvcjMkozdv2ToVtGo9ahva8OmxVjCPP4Fn0zPQNzl0R5LTMuBdn7Rl6ySAKGopIlOEn3pk5Vrk5BbgvY8OgTx+9fWdVgC9dyIjc4fVu16mCGuhliorgpVPyoLC7ORWEWSKMJuMDo32V71fspyOVMoUYXmE5bQyxN/1UqRIkSJFyv2Vh8hHLkVRNEVRCoqiHhVQCNdWCDV3NeQXWBBFUREURUUtkAjhOb781bbgBC5CLMoL8twlD9kCI2KDzN3a4FxnMFjgnp5BKdSM/AXm+cSWIU153QAAAABJRU5ErkJggg==",
  blue: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAA2CAYAAAC1ItuGAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEpElEQVR4nO2Ya0xbZRjHjy4x8cvWCYwOlVDHgLJeYG4jgTCVbCMk+MF9WWIWh8LGpbRAmUHGGG5esmkySQRRBgoMEYiaKJqFRLxMP8uIfpjcKaWuN07L6Q3o6d+8p2dJUysrbdlmcv7JLzk5fc7z/vr0Tc9pKUqIECFChAgR8r8PgBQADUGkUA9LABwG8AGAVh5ynP+gZJIAlPMiAwC+BWACYA6CnPuGryG1ZwDs3kqxBABdLAsWEYZl4QXQCSA+1nJSFpgni0wseNHypQcVXW6MTqxDZ2FhZXywhIC8dmN8DWUdTlwYdGFift0vCswByIiF2yN9fcOSZdqmc3vWfO+PrCKn2YGCt5y4vcTCvOILi9tLXuQ3ryD7rB2Xv3bD7V7zLdO2hd7e4WSyRhR+Tz2+sKDvt1iWcWnQhJzzDo5LX3nCljPb/bQMuZBdb0dWvR1vXr8D0nN+Xt9L1ohYb2zstz0mk5X99ZYZB84aOLlDTQ70/Ly6KTmz3YfuMQ8nl6W1QVGtw81xE0wmq3d09BdJxIJGo0VN3mlDzx1OkMgdamLQd3M1bDEzT89Pq5ycUmuDvEqH+k8M3BSNRrMqYkGatreRJi++bcCz9USQwcFz9xC0/4fgjx4o62wcskodCpt0nCBN2z+MSA7ANoZx/k6afDZqgrbLyMkdbNxA0H5vQUWtDZoOA65959+HZA0Aj0YieNjpdHlIk9lFK2b1NAouOnCgkUFJuxPNQ240D7rR/IUb5zlcHE0DAXzu5DjX78TJVoaTy2u0YXaRxozOygmSNSK66wAoDBSc09M4etGM/VoD9tcZkE2oNSCLULPEodQsQalegoJQrYecoPIjqyIs4rnGv7leQYKF0U9wcRn5DXNQqmf8VM9AwTENOUE1DXnVNGSEyinsI1T4ySyfQuYZPzk1M5jVWWMywW0rK8w4adJ9wwhN21RoOVX4cpmn/VRdnUTniH8PkjUi2oMkDoergzQpvKCHouLPzcmVh5aTlk0h49QtFLw+zwm6XJ72iOT4KWrX173QdNugVE+HLZcZQk7Ky0lLJ5FR+hdU7VaQ3gBqoxFMJx3G/liHQj33LzlZoFzFBnJlgXKEafwwsXb3IWdvxIK85Pc+H3C63RKF3GSA3CRKW8mjIpeRqOTuTtHLsgzjBvtamw2SI1cQL8lFvCQPKUfeg0JjgqLGArmGYIZcbYas2s++KiOSX7iMuJRcxEnykPz8FbxydRmkl5dlV6KeXoBkIQs4P7523bdTnI40eS7HTnE6ninu4r6AFbU05DU05Bo/MjWNlKJOBNd3dvf7WMAB4FhM5AIklUeLT9gTk+Xo+HQYH3UPYdfTMhQdL8GihQ1J0UslCK4/VnzCBkBBbUVE4vTBJ3ZnQNv4LureeAfk+OSrKgbATChePlXJBNeLxGkD1FZlR1JqtigxzUk+KoJInOYQJexVxqo+JtmekJkqEqe1ELYnpO6Jdb0QIUKECBHycOUxcsulKCqBoigxRVFP8oj5czv4mvsa8gsskaIoKUVRijCR8tdE81db2InbhJgiCHLtlodMYVcEE9x1vya40R5M4nmge1AIFZB/AE86UZmFPqtkAAAAAElFTkSuQmCC",
  blueActive: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAA2CAYAAAC1ItuGAAAAEiklEQVR4nO2Ya0xbZRjHjy4x8cvWoUDB0Z5SBsNskMULu4R9c2icEwqlMNzADYeKSxyLGcYYZMswcYmXjNuY04DLoqiJG1kiH6bRaHSMwTZBhXE5rVxa6I3ehtCXv3nPOQiWTuG0bDM5/+SXnJw853l/fc6bntMyjBw5cuTIkSPnfx8ALIDDAbDM3RIA2wC8B+B9EXqcfqdkYgGUiCJnAZwHMAZgPAB67pxYQ2v3A4hZTrFIAB8SQggkhhD4ATQAeDDccsmEgKOLtPf+iUMnncivsqHlp5vgzH6MO0lQBs3TOPejD4aj4zhUZ0NH76QgCgwCWBcOt3uampo1drvT5Ls5NVPR5EJCoRmpL5rRxU3B4iAB+IPSzU0htXgYml0mVHxsB+1ltzuNjY3NKrpGCH5r7jcah85YrXaU1w/xctrCURw+5Vy0nEXktXobNPkmnvIaDrQnxw010jUk6128+IN2bMxKvrlsRnz+DV5Ou2cUdS2eRYtZRGq/mhAE84zQ5HTh2zYzxsZs/tbW7zSSBS0W6wH6SV95l0N8fi8vp90zgoYLniXJWRx+nGxxCXJ5RrC6LpQe7+OnaLGMl0oWdDgmqmmT9AM3EJ9HBUfmCfqXJnh+QhA0cFDrfsHWkm5e0OGYOCFJDsAKt9vbQZvUfjmM/cc5QXA3FXRLEzRwYA0cXni7HzWfm3hBugaAe6UIbvN6fZO0Sb/Rin6THRtLzNDuHoauYhxldXaB2llsPAcpNVaB6jmy3hjl5VL2mtBvtKGPs/KCdA1JTx0AGfMFB0x2PP7yADR5vQKGnjlyf+dhc38DqxfJ+XWO7G6oKbpuPLKvFwOmBYIZoU/QaENKUTdY/XWwOddEroLNFlBnd0KtE8nqmCPzClR/0471BZ18v3BMcIXL5e7k9+AXQyg+1gVWfy24nC64nCpAjufZdhRXXkV1s5EXpGtI2oM0Ho+vjjbZVNIDte7nBXLqW8ll3kruMs+ap79H2t7rvKDPN1kjSU6cYtn0tB/73hkVpJYs175ALm4n5RL2Vv0B2hvAq6EIJtEOX7f5hL2X/V9yV4Le0n/KtSFuZztaL3lmX3LWShYUJS/MzAAFR0zhkXumDQUVA7NyLSHJzU7RT4jb5SUkt3IEMWlHEKHejAj1FsSkHQWr7wOr74d6lpw+gew+qHU9UD72FiJUmxCh2gzlo5XIfdMEt5cQPyGukKc3TzKDAN76U5/MrFYmIXHDFp7VyiTEpp/gv4DZXMqggJ4ygJitHyCwvuH0mRlCQO/v9rDIzZNMfWKHYSJatQF1HzWj9vRniIpbj6eyimA0TwflycwiBNZv32FwAkhhliMKZdKnETHrUPZ6FQ6WHwM9fu75UjeA/mDsKnzJHVivUCaeZZYrq2ITNiqiE730VlEUykSPInJtarjqw5KVkQ8nKJSJFZSVkQnacNfLkSNHjhw5d1fuo49chmEiGYZRMgzzkIhSPLdKrLmtob/AohmGSWYYJmWRJIvXhPJX26LzwBLEUgKg1y576BSiJEww6nZN8N/2YKzIHd2Dcph5+QvyjiKFrjw0+AAAAABJRU5ErkJggg==",
  gray: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAA2CAYAAAC1ItuGAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFJ0lEQVR4nO3Ya0xTdxgG8LOZLNkXxW1ghc3oQNBlaqbflsxsH8RsmsVlyUzMnFlmpoioLVDKveXSAuUiIC2cUqCAitwKAmKneOOikqlxkuky3VCKUG4FehGjh2f5n1VGCw7WgrrkPMmTNM2/7/nx9oQWKIoLFy5cuHDh8r8PgOUAwhy6nHpVAmAjgAwAh20ljz95WRhPAHtskGMATgLoA9DvUPJcre0MOfsjgKXzCXMHkM8wDAMnwzDMUwA0gHfmGrcaQCe5iL53EA3nf0ZZXTN+vduFoWETzJZH03bQaMKtO50orDgDra4NDx6SxbL5E8CqubC9VlxcvsJoHH4wNvZ4/GzrTaSqapBZVIfefiNMlkfT10xqnWhP3xBkinLEpJeivqkdZJbROHxfoylfRq7hgu/dN+/f15cODAyhRtcKuaoGclqLxgvXZo0zma0YNVuh1V1GdFoJolKLcaL2HMjMzk69hlzDaV5TU4t3X98A03H7HuIyjyOF1iIlrxqXr995Ds46LY704tVbLC5SrkGIJBc3O35HX9/AU53u4gqngQbDQBD5SctqL0By+BiS86qRnFuFKzd+m3Frpkk40ub2DhYXkVIEgViJwuOn2C0aDP2BTgONxpEjZEiGqhrijKNIyq1CkrLSHmieGUd6qb2DxYUnF4Ifq4AkTcMCjcaRbKdwABaYTJbrZMi5lhs4qj0HmbISMkXFP2+xeXY4Fnj1FosTJRVAdbQejU1XWCC5BoDXnQFutFisY2SIvrsX3Q8NSFfXQJpTgcKKs6j56QpqdJfZm79a14bq022oamz9u6daUNnQgoqGZrbl9ZegKK5nceKMEui7DejS97JAcg2nPnUAbLYD9hggpysRk1qMaLkGUSlFiEwuRERyAcKT1QhPUkMky4dIqkJYIg1hAo3Q+DyExOchOC4XAokSfLEC0WlF0wE3u7xBMlScoYFIpkKYVAVhIo3QBALIZRscp4RAooBAnAN+7BEcisnGwZhsHIjJQlB0FvZHZSIw8jBC4hQsrkvf4/IGF4yOmm6QIWebr4EuPfkcnHICx7fDZeFAtD0uMCID+8LTkaUqx6kzbSyQXMOpe5DEbLYqyZCknDIIJDlTcXEEp5jAHZoFbp8oHbv5MkTKVCzQah3LcQpn26LgyZOnKNWeZ2FTcBJ73MHJuKipuABRGgLC0rBXKAddUg8yG8AhV4B+ZMLtu10QSlVTceIcO9yBCVwm9kdOxe1lcalsf7n9x7MvDiudBtqQDePj48g/3jgjLmgyLsIRl4o9wlTsCZUjq6DqGa7OJdyzLTIMY3o09phRl52G/7bd8PLeAC+fDdi07QeESdVshYn5CE1QITSeRkgcjWBJHvhiJT7bsgue76+Hp/d6fPrFd8gq0ILMYhhm1OXtTUJuBmDJVZWML+b5wXfNx2wX8/zw5Y4g9hdwmEwNoTR/AhqSQOPzbwLgeJ4uKB0HYAbgPye4Sch1m7ZuH1mybA2UBeVQqE/A470PsfXrnRg0jtp1YIh0BFu+2gnH8/5btw8DWEvNR9x4fmVvLV0FQbgUfFEiyONvvw80Abg3XXfsCjA5nnfj+R6j5iuLPH0+clviayFvFakbz9fs5r5y3Vydn5MsdP/Ax43nG0u60N3He67Pc+HChQsXLq9W3iAfuRRFuVMUxaMoystWnu25RbYzLzTkL7AlFEWtpihq7Sy72vYaV/7VNuu8/R9gax1KXjvvIVvwcGKDHi9qg/92D3ra+lLvQS7UpPwF+DFlCv3bWZMAAAAASUVORK5CYII=",
  red: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAA2CAYAAAC1ItuGAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEn0lEQVR4nO2YfUwbZRzHT5eY+M/GVEYHumwCBaQv1+sLc1D2BwibadxiTJYQE0Ky4QxBZVsGSxyMiSNmJpj4siiiUBxR/lPjHyQji8ElJjpwMFGgoy0tuPYKBfoyNnp8zfP0QNagK23ZZnLf5JNcrr/7PZ/79UmvLcNIkSJFihQpUv73AbATQG0EO5mHJQAKAbQA+ECEHBsflEwqgNdEkS4A3wFwA+AjIOe+FWtIbSWA7Rsplgzgc0EQBMQaQQgB+AzAU4mWy4Eg2Mgad4aG4Gtqwmx1NRYuXULI4YAwPb0m5LVbPT2YPnoUs42NuD04uCxqBZCdCLdHzObuXd4Z78TtWwtL/pYWePbuhWf/fiyOjEDweO4Nz+PO6ChuFhVhymDA3PnzIL28M157R0f3DrJGHH5PP263O7/yeGYwea6ZyvGFhfA1N0ctJ4jMnj1LBaf0etjfaQLpabM5O8gaMev19v6U7nZ7hL/6rsBSUEjleKMRwc7OdckJPA9fezuVm9TrMczpMNV3BbzbE+rp+XFXzIIul6ea3Kn97XqM5RupnNtoRKCrK2oxQcRvNlO5SZ0OwywHy8k6OkWXi6+KWdDrnfuINLG8/ArG9hRQOXdBwb8L8mvL0QkSQZ0OTq0Wv7Mc/njRRAW93rkPY5IDsMnnC/TT/dduhv1kHZWjghcvrksuJAoSOcKNmuOwt31JBckaAB6NRbAwEAgukCZuqx0eqx38vn1w5edj5vBhzDU2YvbMmbtpaKB4CfX1mCGcPk1xl5dTuSnyKTBug3vcRgXJGjE9dQCUrgiSZrYJ2E0mWHY/TxnL2x3GkIdRgt6AEYJOjxGtLgynpfyp4cKwGliKi+nNRgiWxjfBcRt4qx3DRcUYMuRhUG+gXFtGp8dvWl0YThtGw1EGWE0YNYt+lRrX8gtov0RMcNP8vG+ANHG2mzFUcwKDkXI6/brkKEoVBqrfhK21jQqSNWLagyR+f/ACaTJqegk/6wzrl1Ozd8ldVaoofblKXC8uoYLB4MLHMcmJUzy2uBjCzeMnqFRUcuyqqa0hd1WhxC8KJZzVb4D0BvBWPIJZpMPC5cu4HoXcQBRyv+Yq0K9QItjbu/wdJzNmQVHyBywtwVlVtbachru3nEK5IkewHTmyLPd9XHLLUxRCIZ/g8wmuykrUydXITMuGPC0bpzJVsGp1sHHaMBoOVgKroVjULGrTc1fqa5/NxWRFBUgvIRSaj3t6qyRLIQiBT1vNS1tlWZAr91C2yrLwfrYq/ITgODgIGg0cLIsJlsV7mQpE1re2dS5BEPwAShIit0pS/YLp0FzKDiUufNGNT9q+wbZnFDh4sAyLTuc/OBwrHDhQhsj6EtOhWQAqZiOSJMv6+ont2Th26hxq6t4FOX61osoH4MZalJW/7ousT5LJu5iNypbUDE1SijxA3ipCkkzuT0rOVCeqPiHZnPxcRpJM3kDYnJyRnuh6KVKkSJEi5eHKY+SRyzBMMsMwMoZh0kRk4rktYs19DfkFlsIwTA7DMKooyRGvieevtqjz5DrEVBGQazc8ZArbYpjgtvs1wf/ag6kiD3QPSmFW5W9/NhluxnTFtwAAAABJRU5ErkJggg==",
} as const;

function popupHtml(d: LiveDriver): string {
  const plate = d.vehicle?.plate ?? d.driver_ref ?? "—";
  const veh = d.vehicle ? `${d.vehicle.model ?? ""}${d.vehicle.type ? `  ·  ${d.vehicle.type}` : ""}` : "No vehicle";
  const ref = d.driver_ref ?? d.driver_id.slice(0, 8);
  const vendor = d.vendor?.name ?? "—";
  const route = d.trip
    ? `${d.trip.from} <span style="color:#CBD5E1;margin:0 3px;">→</span> ${d.trip.to}`
    : "Idle — no active trip";
  const badge = !d.is_online
    ? `<span style="background:#F1F5F9;color:#475569;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-flex;align-items:center;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#94A3B8;display:inline-block;"></span>Offline</span>`
    : `<span style="background:#DCFCE7;color:#15803D;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-flex;align-items:center;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#16A34A;display:inline-block;"></span>${d.status}</span>`;
  return `
    <div onclick="window.__liveMapSelectDriver('${d.driver_id}',${d.lat},${d.lng})" style="font-family:system-ui,sans-serif;min-width:210px;cursor:pointer;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
        <span style="font-size:14px;font-weight:800;color:#0F172A;font-family:monospace;letter-spacing:0.3px;">${escapeHtml(plate)}</span>
        ${badge}
      </div>
      <div style="font-size:12.5px;font-weight:700;color:#1E293B;margin-bottom:2px;">${escapeHtml(d.name)}</div>
      <div style="font-size:11px;color:#64748B;margin-bottom:8px;">${escapeHtml(d.phone)}</div>
      <div style="background:#F1F5F9;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
        <div style="font-size:11px;color:#475569;">${escapeHtml(veh)}</div>
      </div>
      <div style="border-top:1px solid #F1F5F9;padding-top:7px;">
        <div style="font-size:9.5px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${escapeHtml(ref)} · ${escapeHtml(vendor)}</div>
        <div style="font-size:11.5px;color:#475569;">${route}</div>
      </div>
      <div style="margin-top:9px;padding-top:7px;border-top:1px solid #F1F5F9;text-align:center;font-size:10px;font-weight:700;color:#2563EB;letter-spacing:0.3px;">View details →</div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

let cssInjected = false;
function injectCss() {
  if (cssInjected || typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = `
    .drv-popup .mapboxgl-popup-content {
      padding: 12px 14px !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.16) !important;
      border: 1.5px solid #E8EEF4 !important;
    }
    .drv-popup .mapboxgl-popup-tip { display: none !important; }

    /* History — date card (transparent native input layered over a custom display) */
    .hist-date-card { position: relative; }
    .hist-date-card input[type="date"] {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
      border: none; padding: 0; margin: 0; background: transparent;
      font: inherit; color: transparent;
    }
    .hist-date-card input[type="date"]::-webkit-calendar-picker-indicator {
      position: absolute; inset: 0; width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
    }
    .hist-date-card:hover .hist-date-display {
      background: #F1F5F9;
      border-color: #CBD5E1;
    }

    /* History — time card (transparent native input layered over a custom display) */
    .hist-time-card { position: relative; flex: 1; }
    .hist-time-card input[type="time"] {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
      border: none; padding: 0; margin: 0; background: transparent;
      font: inherit; color: transparent;
    }
    .hist-time-card input[type="time"]::-webkit-calendar-picker-indicator {
      position: absolute; inset: 0; width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
    }
    .hist-time-card:hover .hist-time-display {
      background: #F1F5F9;
      border-color: #CBD5E1;
    }
    .hist-time-card:focus-within .hist-time-display {
      border-color: #2563EB;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
    }
  `;
  document.head.appendChild(s);
  cssInjected = true;
}

type MarkerVisual = { icon: keyof typeof DRIVER_MARKER_PNG; glow: string };

function markerColors(d: LiveDriver, selected: boolean): MarkerVisual {
  const sos = (d as unknown as { sos?: boolean }).sos === true;
  if (sos) return { icon: "red", glow: "drop-shadow(0 0 10px rgba(239,68,68,0.55))" };
  if (!d.is_online) return { icon: "gray", glow: "drop-shadow(0 1px 4px rgba(100,116,139,0.35))" };
  if (d.status === "On Trip") {
    return {
      icon: selected ? "blueActive" : "blue",
      glow: selected
        ? "drop-shadow(0 0 9px rgba(37,99,235,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
        : "drop-shadow(0 2px 6px rgba(59,130,246,0.45)) drop-shadow(0 1px 3px rgba(0,0,0,0.18))",
    };
  }
  return {
    icon: selected ? "greenActive" : "green",
    glow: selected
      ? "drop-shadow(0 0 9px rgba(34,197,94,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
      : "drop-shadow(0 2px 6px rgba(34,197,94,0.45)) drop-shadow(0 1px 3px rgba(0,0,0,0.18))",
  };
}

function markerDotColor(d: LiveDriver): string {
  if (!d.is_online) return "#94A3B8";
  if (d.status === "On Trip") return "#2563EB";
  return "#22C55E";
}

function markerCarFilter(d: LiveDriver): string {
  const sos = (d as unknown as { sos?: boolean }).sos === true;
  if (sos) return "hue-rotate(0deg)"; // SOS is red
  if (!d.is_online) return "hue-rotate(0deg)"; // Offline is red
  if (d.status === "On Trip") {
    return "hue-rotate(220deg) saturate(1.3) brightness(0.95)"; // Blue (#3B82F6 style)
  }
  return "hue-rotate(135deg) saturate(1.2) brightness(0.95)"; // Green (#22C55E style)
}

function createMarkerEl(d: LiveDriver, selected: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;position:relative;overflow:visible;";
  const c = markerColors(d, selected);
  const dot = markerDotColor(d);
  const plate = d.vehicle?.plate ?? d.driver_ref ?? "DRIVER";
  const carFilter = markerCarFilter(d);
  el.innerHTML = `
    <div class="car-wrap" style="position:relative;filter:${c.glow};transition:filter 0.2s;overflow:visible;">
      <span class="status-dot" style="position:absolute;top:-5px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:${dot};border:2px solid #fff;box-shadow:0 0 0 3px rgba(255,255,255,0.88), 0 0 10px ${dot}88;z-index:4;"></span>
      <img class="car-img" src="${DRIVER_MARKER_SRC}" alt="" width="46" height="48" draggable="false" style="display:block;width:46px;height:48px;user-select:none;-webkit-user-drag:none;filter:${carFilter};transition:filter 0.2s;" />
    </div>
    <span class="reg-lbl" style="background:${selected ? ACCENT : "#fff"};color:${selected ? "#fff" : "#0F172A"};font-size:9px;font-weight:800;padding:2px 7px;border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,0.16);white-space:nowrap;font-family:monospace;letter-spacing:0.5px;margin-top:-2px;">${escapeHtml(plate)}</span>
  `;
  return el;
}

function updateMarkerStyle(el: HTMLDivElement, d: LiveDriver, selected: boolean, plate: string) {
  const dot = el.querySelector(".status-dot") as HTMLSpanElement | null;
  const wrap = el.querySelector(".car-wrap") as HTMLDivElement | null;
  const img = el.querySelector(".car-img") as HTMLImageElement | null;
  const lbl = el.querySelector(".reg-lbl") as HTMLSpanElement | null;
  if (!dot || !wrap || !img || !lbl) return;
  const c = markerColors(d, selected);
  dot.style.background = markerDotColor(d);
  dot.style.boxShadow = `0 0 0 3px rgba(255,255,255,0.88), 0 0 10px ${markerDotColor(d)}88`;
  img.src = DRIVER_MARKER_SRC;
  img.style.filter = markerCarFilter(d);
  wrap.style.filter = c.glow;
  lbl.style.background = selected ? ACCENT : "#fff";
  lbl.style.color = selected ? "#fff" : "#0F172A";
  lbl.textContent = plate;
}

/* ── History layer helpers ──────────────────────────────────────────── */
const HIST_SOURCE = "driver-history";
const HIST_LINE = "driver-history-line";
const HIST_DOTS = "driver-history-dots";

function addHistoryLayers(map: mapboxgl.Map, points: LocationHistoryPoint[]): void {
  const coords = points.map((p) => [p.lng, p.lat]);
  map.addSource(HIST_SOURCE, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
        { type: "Feature", properties: { pt: "start" }, geometry: { type: "Point", coordinates: coords[0] } },
        { type: "Feature", properties: { pt: "end" }, geometry: { type: "Point", coordinates: coords[coords.length - 1] } },
      ],
    },
  });
  map.addLayer({
    id: HIST_LINE, type: "line", source: HIST_SOURCE,
    filter: ["==", "$type", "LineString"],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#2563EB", "line-width": 3, "line-opacity": 0.8 },
  });
  map.addLayer({
    id: HIST_DOTS, type: "circle", source: HIST_SOURCE,
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-radius": 7,
      "circle-color": ["case", ["==", ["get", "pt"], "start"], "#22C55E", "#EF4444"],
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#fff",
    },
  });
}

function removeHistoryLayers(map: mapboxgl.Map): void {
  if (map.getLayer(HIST_DOTS)) map.removeLayer(HIST_DOTS);
  if (map.getLayer(HIST_LINE)) map.removeLayer(HIST_LINE);
  if (map.getSource(HIST_SOURCE)) map.removeSource(HIST_SOURCE);
}

function addTrafficToMap(map: mapboxgl.Map, visible: boolean): void {
  if (!map.getSource("mapbox-traffic")) {
    map.addSource("mapbox-traffic", {
      type: "vector",
      url: "mapbox://mapbox.mapbox-traffic-v1",
    });
  }
  if (!map.getLayer("traffic-lines")) {
    map.addLayer({
      id: "traffic-lines",
      type: "line",
      source: "mapbox-traffic",
      "source-layer": "traffic",
      layout: { visibility: visible ? "visible" : "none" },
      paint: {
        "line-width": 3,
        "line-color": [
          "match",
          ["get", "congestion"],
          "low", "#00E653",
          "moderate", "#FFD600",
          "heavy", "#E65100",
          "severe", "#C50000",
          "#CBD5E1",
        ] as mapboxgl.Expression,
      },
    });
  }
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface MarkerRef {
  marker: mapboxgl.Marker;
  el: HTMLDivElement;
  popup: mapboxgl.Popup;
  visKey: string;
  popupKey: string;
}

/* ── Component ──────────────────────────────────────────────────────── */
export default function LiveMapPage() {
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // History mode
  const [mode, setMode] = useState<"live" | "history">("live");
  const [histSearch, setHistSearch] = useState("");
  const [histDriver, setHistDriver] = useState<LiveDriver | null>(null);
  const toDateStr = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr = toDateStr(new Date());
  const yesterdayStr = toDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const formatDateLong = (s: string) => {
    if (!s) return "";
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  };
  const [histDate, setHistDate] = useState<string>(todayStr);
  const [histStartTime, setHistStartTime] = useState<string>("00:00");
  const [histEndTime, setHistEndTime] = useState<string>("23:59");
  const [histApplied, setHistApplied] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [histPoints, setHistPoints] = useState<LocationHistoryPoint[] | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);

  const font = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

  const [trafficEnabled, setTrafficEnabled] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, MarkerRef>>({});
  const driversRef = useRef<LiveDriver[]>([]);
  const modeRef = useRef<"live" | "history">("live");
  const trafficEnabledRef = useRef(false);
  driversRef.current = drivers;
  modeRef.current = mode;

  // Strip <main> padding so map bleeds edge-to-edge
  useEffect(() => {
    const mainEl = document.querySelector<HTMLElement>("main");
    if (!mainEl) return;
    const prev = { padding: mainEl.style.padding, overflow: mainEl.style.overflow };
    mainEl.style.padding = "0";
    mainEl.style.overflow = "hidden";
    return () => { mainEl.style.padding = prev.padding; mainEl.style.overflow = prev.overflow; };
  }, []);

  /* ── Snapshot fetch ─────────────────────────────────────────────── */
  const loadSnapshot = useCallback(async () => {
    try {
      const res = await superadminApi.liveMap.snapshot();
      setDrivers(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
    const t = setInterval(loadSnapshot, REFETCH_MS);
    return () => clearInterval(t);
  }, [loadSnapshot]);

  /* ── Socket subscription ────────────────────────────────────────── */
  useEffect(() => {
    const sock = getSocket();
    const onUpdate = (ev: LiveLocationEvent) => {
      if (!ev.driver_id) return;
      setDrivers((prev) => {
        const idx = prev.findIndex((d) => d.driver_id === ev.driver_id);
        if (idx === -1) { loadSnapshot(); return prev; }
        const next = prev.slice();
        next[idx] = { ...next[idx], lat: ev.lat, lng: ev.lng, speed: ev.speed, updated_at: ev.updated_at };
        return next;
      });
    };
    const onStatus = (ev: DriverStatusEvent) => {
      if (!ev.driver_id) return;
      setDrivers((prev) => {
        const idx = prev.findIndex((d) => d.driver_id === ev.driver_id);
        if (idx === -1) {
          // Driver isn't in the current snapshot (e.g. just came online for the
          // first time today) — refetch so they show up.
          loadSnapshot();
          return prev;
        }
        const next = prev.slice();
        next[idx] = {
          ...next[idx],
          is_online: ev.is_online,
          status: ev.status as LiveDriver["status"],
          speed: ev.is_online ? next[idx].speed : null,
          updated_at: ev.last_seen_at,
          ...(ev.lat != null ? { lat: ev.lat } : {}),
          ...(ev.lng != null ? { lng: ev.lng } : {}),
        };
        return next;
      });
    };
    sock.on("superadmin:location:update", onUpdate);
    sock.on("superadmin:driver:status", onStatus);
    return () => {
      sock.off("superadmin:location:update", onUpdate);
      sock.off("superadmin:driver:status", onStatus);
    };
  }, [loadSnapshot]);

  /* ── Popup click → select driver ───────────────────────────────── */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__liveMapSelectDriver = (
      driverId: string, lat: number, lng: number,
    ) => {
      setSelectedId((prev) => (prev === driverId ? null : driverId));
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 900, essential: true });
    };
    return () => { delete (window as unknown as Record<string, unknown>).__liveMapSelectDriver; };
  }, []);

  /* ── Mapbox init ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) { setError("Mapbox token missing — set NEXT_PUBLIC_MAPBOX_TOKEN"); return; }
    injectCss();
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: BANGALORE_CENTER,
      zoom: 11,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    setMapReady(true);

    let styleLoaded = false;
    map.on("load", () => {
      styleLoaded = true;
      addTrafficToMap(map, trafficEnabledRef.current);
    });
    map.on("style.load", () => {
      if (!styleLoaded) return;
      addTrafficToMap(map, trafficEnabledRef.current);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapContainerRef.current);
    return () => {
      ro.disconnect();
      Object.values(markersRef.current).forEach((m) => m.marker.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  /* ── Reconcile markers ──────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    drivers.forEach((d) => {
      seen.add(d.driver_id);
      const selected = d.driver_id === selectedId;
      const plate = d.vehicle?.plate ?? d.driver_ref ?? "DRIVER";
      const existing = markersRef.current[d.driver_id];
      const visKey = `${selected}|${d.is_online}|${d.status}|${plate}`;
      const popupKey = `${visKey}|${d.name}|${d.phone}|${d.vendor?.name ?? ""}|${d.vehicle?.model ?? ""}|${d.vehicle?.type ?? ""}|${d.trip?.from ?? ""}|${d.trip?.to ?? ""}|${d.trip?.booking_ref ?? ""}|${d.driver_ref ?? ""}`;
      if (existing) {
        existing.marker.setLngLat([d.lng, d.lat]);
        existing.popup.setLngLat([d.lng, d.lat]);
        if (existing.popupKey !== popupKey) { existing.popup.setHTML(popupHtml(d)); existing.popupKey = popupKey; }
        if (existing.visKey !== visKey) { updateMarkerStyle(existing.el, d, selected, plate); existing.visKey = visKey; }
        return;
      }
      const el = createMarkerEl(d, selected);
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([d.lng, d.lat]).addTo(map);
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: [0, -66], className: "drv-popup", maxWidth: "270px" })
        .setLngLat([d.lng, d.lat]).setHTML(popupHtml(d));
      let hideTimer: ReturnType<typeof setTimeout> | null = null;
      const showPopup = () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!popup.isOpen()) {
          popup.addTo(map);
          const popupEl = popup.getElement();
          if (popupEl) {
            popupEl.addEventListener("mouseenter", () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });
            popupEl.addEventListener("mouseleave", hidePopupSoon);
          }
        }
      };
      const hidePopupSoon = () => { if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { popup.remove(); hideTimer = null; }, 120); };
      el.addEventListener("mouseenter", showPopup);
      el.addEventListener("mouseleave", hidePopupSoon);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (modeRef.current === "history") return;
        const cur = driversRef.current.find((x) => x.driver_id === d.driver_id);
        if (!cur) return;
        setSelectedId((prev) => (prev === d.driver_id ? null : d.driver_id));
        map.flyTo({ center: [cur.lng, cur.lat], zoom: 14, duration: 900, essential: true });
      });
      markersRef.current[d.driver_id] = { marker, el, popup, visKey, popupKey };
    });
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) { markersRef.current[id].marker.remove(); delete markersRef.current[id]; }
    });
  }, [drivers, selectedId, mapReady]);

  /* ── History: fetch points when driver / applied range changes ──── */
  useEffect(() => {
    if (!histDriver || !histApplied) { setHistPoints(null); setHistError(null); return; }
    const from = new Date(`${histApplied.date}T${histApplied.startTime}:00`);
    const to = new Date(`${histApplied.date}T${histApplied.endTime}:59`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      setHistError("Invalid date/time range");
      setHistPoints(null);
      return;
    }
    setHistLoading(true);
    setHistError(null);
    superadminApi.drivers
      .locationHistory(histDriver.user_id, { from: from.toISOString(), to: to.toISOString() })
      .then((res) => setHistPoints(res.data.history))
      .catch((err) => setHistError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setHistLoading(false));
  }, [histDriver, histApplied]);

  /* ── History: draw / clear map layer ────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mode !== "history" || !histPoints || histPoints.length < 2) {
      if (map.isStyleLoaded()) removeHistoryLayers(map);
      return;
    }
    const apply = () => {
      removeHistoryLayers(map);
      addHistoryLayers(map, histPoints);
      const lngs = histPoints.map((p) => p.lng);
      const lats = histPoints.map((p) => p.lat);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 60, bottom: 60, left: 60, right: 360 }, duration: 900 },
      );
    };
    if (map.isStyleLoaded()) apply(); else map.once("style.load", apply);
  }, [mode, histPoints]);

  /* ── Clean up history when switching back to live ────────────────── */
  useEffect(() => {
    if (mode === "live") {
      setHistDriver(null);
      setHistPoints(null);
      setHistSearch("");
      setHistError(null);
      setHistApplied(null);
      setSelectedId(null);
      const map = mapRef.current;
      if (map?.isStyleLoaded()) removeHistoryLayers(map);
    }
  }, [mode]);

  function handleTripClick(d: LiveDriver) {
    setSelectedId(d.driver_id);
    mapRef.current?.flyTo({ center: [d.lng, d.lat], zoom: 14, duration: 900, essential: true });
  }

  function toggleTraffic() {
    const next = !trafficEnabledRef.current;
    trafficEnabledRef.current = next;
    setTrafficEnabled(next);
    const map = mapRef.current;
    if (map && map.isStyleLoaded() && map.getLayer("traffic-lines")) {
      map.setLayoutProperty("traffic-lines", "visibility", next ? "visible" : "none");
    }
  }

  const onlineCount = drivers.filter((d) => d.is_online).length;
  const offlineCount = drivers.filter((d) => !d.is_online).length;

  const filtered = drivers.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const plate = (d.vehicle?.plate ?? "").toLowerCase().replace(/-/g, "");
    return (
      d.name.toLowerCase().includes(q) ||
      (d.vendor?.name ?? "").toLowerCase().includes(q) ||
      (d.driver_ref ?? "").toLowerCase().includes(q) ||
      (d.trip?.booking_ref ?? "").toLowerCase().includes(q) ||
      plate.includes(q.replace(/-/g, ""))
    );
  });

  const histFiltered = drivers.filter((d) => {
    if (!histSearch) return true;
    const q = histSearch.toLowerCase();
    const plate = (d.vehicle?.plate ?? "").toLowerCase().replace(/-/g, "");
    return (
      d.name.toLowerCase().includes(q) ||
      (d.driver_ref ?? "").toLowerCase().includes(q) ||
      plate.includes(q.replace(/-/g, ""))
    );
  });

  const selected = drivers.find((d) => d.driver_id === selectedId) ?? null;

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="w-full h-full" style={{ fontFamily: font, color: "#0F172A", position: "relative", overflow: "hidden" }}>
      {/* Map (full bleed) */}
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Floating header (top-left) */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(226,232,240,0.9)", borderRadius: 12, padding: "10px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.15 }}>Live Map</p>
          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Real-time vehicle tracking across all vendors</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 18, padding: "4px 10px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A", display: "inline-block" }} className="animate-pulse" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#15803D" }}>{onlineCount} online</span>
          </div>
          {offlineCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 18, padding: "4px 10px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#94A3B8", display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>{offlineCount} offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ position: "absolute", top: 76, left: 16, zIndex: 10, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(226,232,240,0.9)", borderRadius: 11, padding: "9px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontFamily: font }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, marginRight: 2 }}>Legend</span>
        {[
          { color: "#22C55E", label: "Online" },
          { color: "#3B82F6", label: "On Trip" },
          { color: "#EF4444", label: "Offline" },
        ].map((it) => (
          <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#334155" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: it.color, flexShrink: 0, boxShadow: "0 0 0 1.5px white, 0 0 0 2.5px rgba(15,23,42,0.06)" }} />
            {it.label}
          </span>
        ))}
      </div>

      {/* Traffic toggle button — left side, below legend */}
      <button
        onClick={toggleTraffic}
        style={{
          position: "absolute", top: 122, left: 16, zIndex: 10,
          display: "flex", alignItems: "center", gap: 7,
          padding: "7px 13px",
          background: trafficEnabled ? ACCENT : "rgba(255,255,255,0.97)",
          border: `1.5px solid ${trafficEnabled ? "#1d4ed8" : "rgba(226,232,240,0.9)"}`,
          borderRadius: 11,
          boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
          fontFamily: font,
          fontSize: 12,
          fontWeight: 700,
          color: trafficEnabled ? "#fff" : "#0F172A",
          userSelect: "none",
        }}
        title={trafficEnabled ? "Hide traffic layer" : "Show traffic layer"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="2" width="6" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="7" r="1.8" fill={trafficEnabled ? "#fca5a5" : "#EF4444"} />
          <circle cx="12" cy="12" r="1.8" fill={trafficEnabled ? "#fde68a" : "#F59E0B"} />
          <circle cx="12" cy="17" r="1.8" fill={trafficEnabled ? "#bbf7d0" : "#22C55E"} />
        </svg>
        Traffic
        <span style={{
          fontSize: 9.5, fontWeight: 800, padding: "1px 6px", borderRadius: 4,
          background: trafficEnabled ? "rgba(255,255,255,0.22)" : "#F1F5F9",
          color: trafficEnabled ? "#fff" : "#64748B",
          letterSpacing: 0.3,
        }}>
          {trafficEnabled ? "ON" : "OFF"}
        </span>
      </button>

      {/* Traffic color legend — shown when traffic is ON */}
      {trafficEnabled && (
        <div style={{
          position: "absolute", top: 166, left: 16, zIndex: 10,
          background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
          border: "1.5px solid rgba(226,232,240,0.9)",
          borderRadius: 11, padding: "9px 12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          fontFamily: font,
        }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 7 }}>Traffic</div>
          {[
            { label: "Low", color: "#00E653" },
            { label: "Moderate", color: "#FFD600" },
            { label: "Heavy", color: "#E65100" },
            { label: "Severe", color: "#C50000" },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <div style={{ width: 18, height: 4, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#334155" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 20, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Collapsed handle */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          title="Show panel"
          style={{ position: "absolute", top: 16, right: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", height: 42, borderRadius: 11, border: "1.5px solid rgba(226,232,240,0.9)", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", cursor: "pointer", color: "#0F172A", fontFamily: font, fontWeight: 700, fontSize: 12.5 }}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: "#64748B" }} />
          <span>{onlineCount} online{offlineCount > 0 ? ` · ${offlineCount} offline` : ""}</span>
        </button>
      )}

      {/* ── Right panel ─────────────────────────────────────────────── */}
      {panelOpen && (
        <div style={{ position: "absolute", top: 12, right: 12, bottom: 12, width: 320, zIndex: 10, borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(226,232,240,0.9)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>

          {/* Mode tabs + collapse */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            <button
              onClick={() => setMode("live")}
              style={{ flex: 1, height: 32, borderRadius: 8, border: `1.5px solid ${mode === "live" ? ACCENT : "#E2E8F0"}`, background: mode === "live" ? "#EFF6FF" : "#fff", color: mode === "live" ? ACCENT : "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: font }}
            >
              <Circle className="h-3 w-3 fill-current" /> Online
            </button>
            <button
              onClick={() => setMode("history")}
              style={{ flex: 1, height: 32, borderRadius: 8, border: `1.5px solid ${mode === "history" ? ACCENT : "#E2E8F0"}`, background: mode === "history" ? "#EFF6FF" : "#fff", color: mode === "history" ? ACCENT : "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: font }}
            >
              <Clock className="h-3 w-3" /> History
            </button>
            <button
              onClick={() => setPanelOpen(false)}
              title="Hide panel"
              style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <ChevronRight className="h-4 w-4" style={{ color: "#64748B" }} />
            </button>
          </div>

          {/* ── LIVE MODE ── */}
          {mode === "live" && (
            <>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                <div style={{ position: "relative" }}>
                  <Search className="h-4 w-4" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search driver, vehicle, trip…"
                    style={{ width: "100%", paddingLeft: 34, paddingRight: search ? 30 : 10, height: 36, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontFamily: font, color: "#0F172A", outline: "none", boxSizing: "border-box" }}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} title="Clear" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Drivers</p>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{filtered.length} shown · {onlineCount} online · {offlineCount} offline</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {loading ? (
                  <div className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} style={{ padding: "11px 15px", borderBottom: "1px solid #F8FAFC", borderLeft: "3px solid transparent" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ width: 92, height: 12, borderRadius: 4, background: "#E2E8F0" }} />
                          <div style={{ width: 42, height: 11, borderRadius: 4, background: "#E2E8F0" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 96, height: 11, borderRadius: 4, background: "#EEF2F7" }} />
                          <div style={{ width: 64, height: 11, borderRadius: 4, background: "#EEF2F7" }} />
                        </div>
                        <div style={{ width: "78%", height: 10, borderRadius: 4, background: "#EEF2F7" }} />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>
                    {drivers.length === 0 ? "No drivers online right now." : "No results."}
                  </p>
                ) : filtered.map((d) => {
                  const isSel = d.driver_id === selectedId;
                  const plate = d.vehicle?.plate ?? "—";
                  return (
                    <div
                      key={d.driver_id}
                      onClick={() => handleTripClick(d)}
                      style={{ padding: "11px 15px", borderBottom: "1px solid #F8FAFC", cursor: "pointer", background: isSel ? "#EFF6FF" : "transparent", borderLeft: isSel ? `3px solid ${ACCENT}` : "3px solid transparent", transition: "background 0.12s" }}
                      onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                      onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", letterSpacing: "0.3px" }}>{plate}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: !d.is_online ? "#94A3B8" : "#16A34A" }}>
                          <Circle className="h-2 w-2 fill-current" /> {!d.is_online ? "Offline" : "Online"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{d.name}</span>
                        {d.vehicle?.model && <span style={{ fontSize: 11, color: "#94A3B8" }}>· {d.vehicle.model}</span>}
                      </div>
                      <p style={{ fontSize: 11, color: "#64748B" }}>
                        {d.trip
                          ? <>{d.trip.from} <span style={{ color: "#CBD5E1" }}>→</span> {d.trip.to}</>
                          : <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Idle — no active trip</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── HISTORY MODE ── */}
          {mode === "history" && (
            <>
              {!histDriver ? (
                /* Driver picker */
                <>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                    <div style={{ position: "relative" }}>
                      <Search className="h-4 w-4" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                      <input
                        value={histSearch}
                        onChange={(e) => setHistSearch(e.target.value)}
                        placeholder="Search driver or vehicle…"
                        style={{ width: "100%", paddingLeft: 34, paddingRight: histSearch ? 30 : 10, height: 36, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontFamily: font, color: "#0F172A", outline: "none", boxSizing: "border-box" }}
                      />
                      {histSearch && (
                        <button onClick={() => setHistSearch("")} title="Clear" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                    <p style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
                      Select a driver to view their <strong style={{ color: "#0F172A" }}>location trail</strong> on the map.
                    </p>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {loading ? (
                      <div className="animate-pulse">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} style={{ padding: "11px 15px", borderBottom: "1px solid #F8FAFC" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ width: 110, height: 12, borderRadius: 4, background: "#E2E8F0" }} />
                              <div style={{ width: 42, height: 11, borderRadius: 4, background: "#E2E8F0" }} />
                            </div>
                            <div style={{ width: 140, height: 11, borderRadius: 4, background: "#EEF2F7" }} />
                          </div>
                        ))}
                      </div>
                    ) : histFiltered.length === 0 ? (
                      <p style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>No drivers found.</p>
                    ) : histFiltered.map((d) => (
                      <div
                        key={d.driver_id}
                        onClick={() => {
                          setHistDriver(d);
                          setHistApplied({ date: histDate, startTime: histStartTime, endTime: histEndTime });
                        }}
                        style={{ padding: "11px 15px", borderBottom: "1px solid #F8FAFC", cursor: "pointer", transition: "background 0.12s" }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", letterSpacing: "0.3px" }}>{d.vehicle?.plate ?? d.driver_ref ?? "—"}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: d.is_online ? "#16A34A" : "#94A3B8" }}>
                            <Circle className="h-2 w-2 fill-current" /> {d.is_online ? "Online" : "Offline"}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{d.name}</span>
                          {d.vehicle?.model && <span style={{ fontSize: 11, color: "#94A3B8" }}>· {d.vehicle.model}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* History detail for selected driver */
                <>
                  <div style={{ padding: "9px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                    <button
                      onClick={() => { setHistDriver(null); setHistPoints(null); setHistError(null); setHistApplied(null); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to drivers
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
                    {/* Driver info */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", letterSpacing: "0.3px", marginBottom: 2 }}>
                        {histDriver.vehicle?.plate ?? histDriver.driver_ref ?? "—"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{histDriver.name}</span>
                        {histDriver.vehicle?.model && <span style={{ fontSize: 12, color: "#94A3B8" }}>· {histDriver.vehicle.model}</span>}
                      </div>
                    </div>

                    {/* Date + time range selector */}
                    {(() => {
                      const isDirty =
                        !histApplied ||
                        histApplied.date !== histDate ||
                        histApplied.startTime !== histStartTime ||
                        histApplied.endTime !== histEndTime;
                      const rangeInvalid = histStartTime >= histEndTime;
                      const isEntireDay = histStartTime === "00:00" && histEndTime === "23:59";
                      const setDay = () => { setHistStartTime("00:00"); setHistEndTime("23:59"); };

                      const presets: { label: string; date: string }[] = [
                        { label: "Today", date: todayStr },
                        { label: "Yesterday", date: yesterdayStr },
                      ];

                      return (
                        <div style={{ marginBottom: 16 }}>
                          {/* Header */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                              <Calendar className="h-3 w-3" /> Date & time range
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {presets.map((p) => {
                                const active = histDate === p.date;
                                return (
                                  <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => setHistDate(p.date)}
                                    style={{
                                      fontSize: 10.5, fontWeight: 700,
                                      padding: "3px 9px", borderRadius: 12,
                                      border: `1px solid ${active ? ACCENT : "#E2E8F0"}`,
                                      background: active ? "#EFF6FF" : "#fff",
                                      color: active ? ACCENT : "#64748B",
                                      cursor: "pointer", fontFamily: font,
                                      transition: "all 0.12s",
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Date card (custom display over hidden native input) */}
                          <div style={{ marginBottom: 10 }}>
                            <CustomDatePicker value={histDate} onChange={(v) => setHistDate(v)}>
                              <div
                                style={{
                                  display: "flex", alignItems: "center", gap: 12,
                                  height: 50, padding: "0 14px",
                                  borderRadius: 11,
                                  background: "#F8FAFC",
                                  border: "1.5px solid #E2E8F0",
                                  transition: "all 0.15s",
                                }}
                              >
                                <div style={{
                                  width: 34, height: 34, borderRadius: 9,
                                  background: "#F1F5F9",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0,
                                }}>
                                  <Calendar className="h-4 w-4" style={{ color: "#475569" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    Date
                                  </div>
                                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginTop: 1 }}>
                                    {formatDateLong(histDate)}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4" style={{ color: "#94A3B8", flexShrink: 0 }} />
                              </div>
                            </CustomDatePicker>
                          </div>

                          {/* Time row */}
                          <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 10 }}>
                            {/* From */}
                            <CustomTimePicker value={histStartTime} onChange={v => setHistStartTime(v)}>
                              <div
                                style={{
                                  display: "flex", alignItems: "center", gap: 8,
                                  height: 50, padding: "0 10px",
                                  borderRadius: 11,
                                  background: "#F8FAFC",
                                  border: "1.5px solid #E2E8F0",
                                  transition: "all 0.15s",
                                }}
                              >
                                <div style={{
                                  width: 32, height: 32, borderRadius: 9,
                                  background: "#F1F5F9",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0,
                                }}>
                                  <Clock className="h-4 w-4" style={{ color: "#475569" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    From
                                  </div>
                                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A", marginTop: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {format12h(histStartTime)}
                                  </div>
                                </div>
                              </div>
                            </CustomTimePicker>

                            {/* Separator */}
                            <div style={{ display: "flex", alignItems: "center", color: "#CBD5E1", flexShrink: 0 }}>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </div>

                            {/* To */}
                            <CustomTimePicker value={histEndTime} onChange={v => setHistEndTime(v)} align="right">
                              <div
                                style={{
                                  display: "flex", alignItems: "center", gap: 8,
                                  height: 50, padding: "0 10px",
                                  borderRadius: 11,
                                  background: "#F8FAFC",
                                  border: "1.5px solid #E2E8F0",
                                  transition: "all 0.15s",
                                }}
                              >
                                <div style={{
                                  width: 32, height: 32, borderRadius: 9,
                                  background: "#F1F5F9",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0,
                                }}>
                                  <Clock className="h-4 w-4" style={{ color: "#475569" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    To
                                  </div>
                                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A", marginTop: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {format12h(histEndTime)}
                                  </div>
                                </div>
                              </div>
                            </CustomTimePicker>
                          </div>

                          {/* Entire-day shortcut */}
                          <button
                            type="button"
                            onClick={setDay}
                            disabled={isEntireDay}
                            style={{
                              width: "100%",
                              fontSize: 11, fontWeight: 600,
                              color: isEntireDay ? "#94A3B8" : "#475569",
                              background: isEntireDay ? "#F1F5F9" : "#fff",
                              border: "1px dashed #CBD5E1",
                              borderRadius: 8,
                              padding: "6px 10px",
                              cursor: isEntireDay ? "default" : "pointer",
                              marginBottom: 10,
                              fontFamily: font,
                            }}
                          >
                            {isEntireDay ? "✓ Entire day selected" : "Set entire day (00:00 — 23:59)"}
                          </button>

                          {/* Apply */}
                          <button
                            type="button"
                            disabled={!isDirty || rangeInvalid}
                            onClick={() => setHistApplied({ date: histDate, startTime: histStartTime, endTime: histEndTime })}
                            style={{
                              width: "100%", height: 40, borderRadius: 10, border: "none",
                              background: rangeInvalid ? "#FEE2E2" : (!isDirty ? "#CBD5E1" : ACCENT),
                              color: rangeInvalid ? "#991B1B" : "#fff",
                              fontSize: 13, fontWeight: 700,
                              cursor: (!isDirty || rangeInvalid) ? "not-allowed" : "pointer",
                              fontFamily: font,
                              boxShadow: (!isDirty || rangeInvalid) ? "none" : "0 2px 8px rgba(37,99,235,0.25)",
                              transition: "all 0.15s",
                            }}
                          >
                            {rangeInvalid ? "End must be after start" : (isDirty ? "Apply range" : "✓ Showing this range")}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Loading */}
                    {histLoading && (
                      <div className="animate-pulse">
                        {/* Stats grid skeleton */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                          <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ width: 44, height: 22, borderRadius: 4, background: "#DBE9FF", marginBottom: 6 }} />
                            <div style={{ width: 90, height: 10, borderRadius: 4, background: "#DBE9FF" }} />
                          </div>
                          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ width: 86, height: 13, borderRadius: 4, background: "#E2E8F0", marginBottom: 6 }} />
                            <div style={{ width: 70, height: 10, borderRadius: 4, background: "#E2E8F0" }} />
                          </div>
                        </div>

                        {/* Route window skeleton */}
                        <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                          <div style={{ width: 84, height: 10, borderRadius: 4, background: "#E2E8F0", marginBottom: 10 }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E2E8F0", flexShrink: 0 }} />
                            <div>
                              <div style={{ width: 56, height: 12, borderRadius: 4, background: "#E2E8F0", marginBottom: 4 }} />
                              <div style={{ width: 32, height: 10, borderRadius: 4, background: "#EEF2F7" }} />
                            </div>
                          </div>
                          <div style={{ marginLeft: 4.5, width: 1, height: 14, background: "#E2E8F0", marginBottom: 8 }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E2E8F0", flexShrink: 0 }} />
                            <div>
                              <div style={{ width: 56, height: 12, borderRadius: 4, background: "#E2E8F0", marginBottom: 4 }} />
                              <div style={{ width: 38, height: 10, borderRadius: 4, background: "#EEF2F7" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {histError && !histLoading && (
                      <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
                        {histError}
                      </div>
                    )}

                    {/* Results */}
                    {histPoints && !histLoading && (
                      histPoints.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "28px 0" }}>
                          <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 4 }}>No location data</div>
                          <div style={{ fontSize: 11.5, color: "#CBD5E1" }}>
                            No points recorded for{histApplied ? ` ${histApplied.date} ${histApplied.startTime}–${histApplied.endTime}` : " the selected range"}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Stats grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                            <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 14px" }}>
                              <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{histPoints.length}</div>
                              <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>points recorded</div>
                            </div>
                            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                                {histApplied ? `${histApplied.startTime}–${histApplied.endTime}` : ""}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>
                                {histApplied?.date ?? ""}
                              </div>
                            </div>
                          </div>

                          {/* Time range card */}
                          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Route window</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", flexShrink: 0, boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px #22C55E44" }} />
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{fmtTime(histPoints[0].recorded_at)}</div>
                                <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Start</div>
                              </div>
                            </div>
                            <div style={{ marginLeft: 4.5, width: 1, height: 14, background: "#E2E8F0", marginBottom: 8 }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", flexShrink: 0, boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px #EF444444" }} />
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{fmtTime(histPoints[histPoints.length - 1].recorded_at)}</div>
                                <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Latest</div>
                              </div>
                            </div>
                          </div>

                        </>
                      )
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Live selected detail card (live mode only) ───────────────── */}
      {mode === "live" && selected && (() => {
        const speedKmh = selected.speed != null ? Math.round(selected.speed) : null;
        const lastSeen = (() => {
          const ms = Date.now() - new Date(selected.updated_at).getTime();
          const s = Math.floor(ms / 1000);
          if (s < 60) return `${s}s ago`;
          const m = Math.floor(s / 60);
          if (m < 60) return `${m} min ago`;
          return `${Math.floor(m / 60)}h ago`;
        })();
        return (
          <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, background: "rgba(255,255,255,0.97)", border: "1.5px solid rgba(226,232,240,0.9)", borderRadius: 14, padding: "13px 16px", width: 320, maxWidth: "calc(100vw - 24px)", backdropFilter: "blur(8px)", boxShadow: "0 6px 28px rgba(0,0,0,0.14)", fontFamily: font }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: "#EFF6FF", padding: "3px 9px", borderRadius: 5, fontFamily: "monospace", letterSpacing: 0.4 }}>
                {selected.trip?.booking_ref ?? selected.driver_ref ?? selected.driver_id.slice(0, 8)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: !selected.is_online ? "#475569" : "#15803D", background: !selected.is_online ? "#F1F5F9" : "#DCFCE7", padding: "3px 9px", borderRadius: 12 }}>
                <Circle className="h-2 w-2 fill-current" />
                {!selected.is_online ? "Offline" : selected.status}
              </span>
              <button onClick={() => setSelectedId(null)} title="Close" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0, display: "flex", alignItems: "center" }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 1 }}>{selected.name}</div>
            <div style={{ fontSize: 11.5, color: "#64748B", marginBottom: 10 }}>
              {selected.phone}
              {selected.vendor?.name && <> · <span style={{ fontWeight: 600, color: "#475569" }}>{selected.vendor.name}</span></>}
            </div>
            {selected.vehicle && (
              <div style={{ background: "#F1F5F9", borderRadius: 9, padding: "9px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", letterSpacing: 0.6 }}>{selected.vehicle.plate}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{selected.vehicle.model ?? "—"}{selected.vehicle.type ? ` · ${selected.vehicle.type}` : ""}</div>
              </div>
            )}
            {selected.trip ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#334155", marginBottom: 10, lineHeight: 1.45 }}>
                <Navigation className="h-3.5 w-3.5" style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                <span>
                  <span style={{ color: "#475569" }}>{selected.trip.from}</span>
                  <span style={{ color: "#CBD5E1", margin: "0 3px" }}>→</span>
                  <span style={{ color: "#475569" }}>{selected.trip.to}</span>
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", marginBottom: 10 }}>Idle — no active trip</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 9, borderTop: "1px solid #F1F5F9" }}>
              <div>
                <div style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Speed</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                  {speedKmh != null ? <>{speedKmh}<span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, marginLeft: 3 }}>km/h</span></> : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{selected.is_online ? "Last update" : "Last seen"}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: !selected.is_online ? "#94A3B8" : "#0F172A", fontVariantNumeric: "tabular-nums" }}>{lastSeen}</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
